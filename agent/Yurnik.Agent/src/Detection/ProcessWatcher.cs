// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Diagnostics;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Watches for processes that are known games. When a matching process is
/// first seen, inserts a session row into SessionStore. Session end is
/// detected by SessionMonitor via periodic pid liveness checks.
///
/// Detection strategy (cheapest and most reliable signal first):
///   1. Skip exes on the user's exclusion list (local cache, no API call)
///   2. Match against Discord's public detectable-games executable list
///   3. Match the exe's install path against known launcher directories
///      (Steam, Epic, Ubisoft, Rockstar, ...)
///   4. Otherwise, not a game — drop it
///
/// None of these steps inspect the running process's loaded modules, so
/// detection keeps working even when the target is elevated or protected
/// by anti-cheat — both of which deny live module enumeration from a
/// non-elevated, untrusted caller.
/// </summary>
sealed class ProcessWatcher(
    SessionStore sessions,
    EventQueue queue,
    ExclusionStore exclusions,
    InclusionStore inclusions,
    DetectableGamesCache detectableGames,
    TimeSpan? minSessionDuration = null) : IDisposable
{
    static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    readonly TimeSpan _minSessionDuration = minSessionDuration ?? TimeSpan.FromMinutes(5);

    // In-memory dedup set — avoids redundant DB writes within one agent run.
    // SessionStore uses INSERT OR IGNORE, so this is an optimisation only.
    readonly HashSet<int> _seen = [];
    readonly HashSet<int> _ignored = [];
    
    // Level 2 Cache: Path -> (LastWriteTime, IsGame)
    // Avoids re-parsing the PE file for non-game apps that restart.
    readonly Dictionary<string, (DateTime LastWriteTime, bool IsGame)> _pathCache = [];

    readonly CancellationTokenSource _cts = new();
    Task? _pollTask;

    public void Start()
    {
        _pollTask = PollLoopAsync(_cts.Token);
        Log.Info("ProcessWatcher started");
    }

    public void Stop()
    {
        _cts.Cancel();
        try { _pollTask?.Wait(5000); }
        catch (AggregateException) { }
        Log.Info("ProcessWatcher stopped");
    }

    volatile bool _shouldClearCaches;

    public void ClearCaches()
    {
        _shouldClearCaches = true;
    }

    async Task PollLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            if (_shouldClearCaches)
            {
                _shouldClearCaches = false;
                _ignored.Clear();
                _pathCache.Clear();
                Log.Debug("ProcessWatcher caches cleared due to settings sync");
            }
            Poll();
            await Task.Delay(PollInterval, ct).ConfigureAwait(false);
        }
    }

    void Poll()
    {
        var currentPids = new HashSet<int>();
        var allPids = new HashSet<int>();

        foreach (var process in Process.GetProcesses())
        {
            try
            {
                allPids.Add(process.Id);
                var exePath = ProcessPath.TryGetExecutablePath(process.Id);
                var exeName = exePath is not null ? Path.GetFileName(exePath) : process.ProcessName + ".exe";

                if (exclusions.Contains(exeName))
                {
                    if (_ignored.Add(process.Id))
                        Log.Debug($"Discarding {exeName} (pid {process.Id}): on exclusion list");
                    continue;
                }

                var isKnownGame = inclusions.Contains(exeName)
                    || detectableGames.IsKnownGame(exeName)
                    || (exePath is not null && KnownGamePaths.IsKnownGamePath(exePath));

                // Level 2 Cache & PE Scan fallback
                if (!isKnownGame && exePath is not null)
                {
                    try
                    {
                        var fileInfo = new FileInfo(exePath);
                        if (fileInfo.Exists)
                        {
                            var lastWrite = fileInfo.LastWriteTimeUtc;
                            if (!_pathCache.TryGetValue(exePath, out var cached) || cached.LastWriteTime != lastWrite)
                            {
                                bool hasGameImports = PeScanner.IsGameExecutable(exePath);
                                _pathCache[exePath] = (lastWrite, hasGameImports);
                            }
                            isKnownGame = _pathCache[exePath].IsGame;
                        }
                    }
                    catch
                    {
                        // Ignore file access errors on FileInfo
                    }
                }

                if (!isKnownGame)
                {
                    if (_ignored.Add(process.Id))
                        Log.Debug($"Discarding {exeName} (pid {process.Id}): not a known game (PE scan failed)");
                    continue;
                }

                currentPids.Add(process.Id);

                if (_seen.Contains(process.Id)) continue;

                var windowTitle = process.MainWindowTitle;
                if (string.IsNullOrWhiteSpace(windowTitle))
                {
                    if (_ignored.Add(process.Id))
                        Log.Debug($"Discarding {exeName} (pid {process.Id}): no window title");
                    continue;
                }

                sessions.Insert(process.Id, exeName, windowTitle);
                _seen.Add(process.Id);
                Log.Info($"Game started: {exeName} (pid {process.Id}) — \"{windowTitle}\"");
            }
            catch
            {
                // Access denied on some processes is normal. Skip silently.
            }
            finally
            {
                process.Dispose();
            }
        }

        // Any pid we were tracking that is no longer running has exited — close immediately.
        foreach (var pid in _seen.Except(currentPids).ToList())
        {
            var session = sessions.GetAll().FirstOrDefault(s => s.Pid == pid);
            if (session is not null)
            {
                var endedAt = DateTimeOffset.UtcNow;
                var duration = endedAt - session.StartedAt;
                if (duration >= _minSessionDuration)
                {
                    Log.Info($"Game ended: {session.ExeName} (pid {pid}) — \"{session.WindowTitle}\"");
                    queue.Enqueue(session.ExeName, session.WindowTitle, session.StartedAt, endedAt);
                }
                else
                {
                    Log.Info($"Session discarded: {session.ExeName} ran for only {duration.TotalSeconds:F0}s (below threshold)");
                }
                sessions.Delete(pid);
            }
        }

        _seen.IntersectWith(currentPids);
        _ignored.IntersectWith(allPids);
        
        // Prevent path cache from growing infinitely if the user runs the agent for months
        if (_pathCache.Count > 1000)
        {
            _pathCache.Clear();
        }
    }


    public void Dispose() => Stop();
}
