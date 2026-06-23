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
    DetectableGamesCache detectableGames) : IDisposable
{
    static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    // In-memory dedup set — avoids redundant DB writes within one agent run.
    // SessionStore uses INSERT OR IGNORE, so this is an optimisation only.
    readonly HashSet<int> _seen = [];

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

    async Task PollLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            Poll();
            await Task.Delay(PollInterval, ct).ConfigureAwait(false);
        }
    }

    void Poll()
    {
        var currentPids = new HashSet<int>();

        foreach (var process in Process.GetProcesses())
        {
            try
            {
                var exePath = ProcessPath.TryGetExecutablePath(process.Id);
                var exeName = exePath is not null ? Path.GetFileName(exePath) : process.ProcessName + ".exe";

                if (exclusions.Contains(exeName)) continue;

                var isKnownGame = detectableGames.IsKnownGame(exeName)
                    || (exePath is not null && KnownGamePaths.IsKnownGamePath(exePath));
                if (!isKnownGame) continue;

                currentPids.Add(process.Id);

                if (_seen.Contains(process.Id)) continue;

                var windowTitle = process.MainWindowTitle;
                if (string.IsNullOrWhiteSpace(windowTitle)) continue;

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
                Log.Info($"Game ended: {session.ExeName} (pid {pid}) — \"{session.WindowTitle}\"");
                queue.Enqueue(session.ExeName, session.WindowTitle, session.StartedAt, endedAt);
                sessions.Delete(pid);
            }
        }

        _seen.IntersectWith(currentPids);
    }

    public void Dispose() => Stop();
}
