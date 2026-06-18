// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Diagnostics;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Watches for processes that load a graphics API DLL (DirectX, OpenGL, Vulkan).
/// When a matching process is first seen, inserts a session row into SessionStore.
/// Session end is detected by SessionMonitor via periodic pid liveness checks.
///
/// Detection strategy:
///   - Poll running processes every 5 seconds
///   - For each process, check loaded modules for known graphics DLLs
///   - Track which pids we have already seen this run to avoid redundant DB writes
///
/// This is the simplest approach that works without requiring elevated privileges.
/// WMI process events would be faster but require more setup and can be unreliable.
/// </summary>
sealed class ProcessWatcher : IDisposable
{
    static readonly string[] GraphicsDlls =
    [
        "d3d9.dll", "d3d10.dll", "d3d10_1.dll",
        "d3d11.dll", "d3d12.dll",
        "opengl32.dll",
        "vulkan-1.dll",
    ];

    static readonly string WindowsDir =
        Environment.GetFolderPath(Environment.SpecialFolder.Windows)
            .TrimEnd('\\', '/') + Path.DirectorySeparatorChar;

    static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    readonly SessionStore _sessions;
    readonly EventQueue _queue;
    readonly CancellationTokenSource _cts = new();

    // In-memory dedup set — avoids redundant DB writes within one agent run.
    // SessionStore uses INSERT OR IGNORE, so this is an optimisation only.
    readonly HashSet<int> _seen = [];

    Task? _pollTask;

    public ProcessWatcher(SessionStore sessions, EventQueue queue)
    {
        _sessions = sessions;
        _queue = queue;
    }

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
                if (!HasGraphicsDll(process)) continue;

                currentPids.Add(process.Id);

                if (_seen.Contains(process.Id)) continue;

                var windowTitle = process.MainWindowTitle;
                if (string.IsNullOrWhiteSpace(windowTitle)) continue;

                var exePath = process.MainModule?.FileName ?? "";
                if (exePath.StartsWith(WindowsDir, StringComparison.OrdinalIgnoreCase)) continue;

                var exeName = Path.GetFileName(exePath.Length > 0 ? exePath : process.ProcessName);
                _sessions.Insert(process.Id, exeName, windowTitle);
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
            var session = _sessions.GetAll().FirstOrDefault(s => s.Pid == pid);
            if (session is not null)
            {
                var endedAt = DateTimeOffset.UtcNow;
                Log.Info($"Game ended: {session.ExeName} (pid {pid}) — \"{session.WindowTitle}\"");
                _queue.Enqueue(session.ExeName, session.WindowTitle, session.StartedAt, endedAt);
                _sessions.Delete(pid);
            }
        }

        _seen.IntersectWith(currentPids);
    }

    static bool HasGraphicsDll(Process process)
    {
        try
        {
            foreach (ProcessModule module in process.Modules)
            {
                var name = module.ModuleName?.ToLowerInvariant();
                if (name is not null && Array.Exists(GraphicsDlls, d => d == name))
                    return true;
            }
        }
        catch
        {
            // 32-bit processes on 64-bit OS, system processes, access denied — all normal.
        }
        return false;
    }

    public void Dispose() => Stop();
}
