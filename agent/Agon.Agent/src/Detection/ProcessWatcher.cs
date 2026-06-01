// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Diagnostics;
using System.Runtime.InteropServices;
using Agon.Agent.Infrastructure;
using Agon.Agent.Queue;

namespace Agon.Agent.Detection;

/// <summary>
/// Watches for processes that load a graphics API DLL (DirectX, OpenGL, Vulkan).
/// When a matching process starts or ends, writes a GameStarted/GameEnded event
/// to the queue. Has no knowledge of the API or auth state.
///
/// Detection strategy:
///   - Poll running processes every 5 seconds
///   - For each process, check loaded modules for known graphics DLLs
///   - Track which pids we have already seen to detect start/end transitions
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

    // Executables under these directories are Windows OS components, not games.
    static readonly string WindowsDir =
        Environment.GetFolderPath(Environment.SpecialFolder.Windows)
            .TrimEnd('\\', '/') + Path.DirectorySeparatorChar;

    static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    readonly EventQueue _queue;
    readonly CancellationTokenSource _cts = new();
    readonly Dictionary<int, TrackedProcess> _tracked = [];
    Task? _pollTask;

    public ProcessWatcher(EventQueue queue)
    {
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
        catch (AggregateException) { } // task cancelled on shutdown — expected
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

                if (!_tracked.ContainsKey(process.Id))
                {
                    var windowTitle = process.MainWindowTitle;
                    if (string.IsNullOrWhiteSpace(windowTitle)) continue;

                    var exePath = process.MainModule?.FileName ?? "";
                    if (exePath.StartsWith(WindowsDir, StringComparison.OrdinalIgnoreCase)) continue;

                    var exeName = Path.GetFileName(exePath.Length > 0 ? exePath : process.ProcessName);
                    _tracked[process.Id] = new TrackedProcess(process.Id, exeName, windowTitle);
                    _queue.Enqueue(QueueEventType.GameStarted, exeName, windowTitle);
                    Log.Info($"Game started: {exeName} (pid {process.Id}) — \"{windowTitle}\"");
                }
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

        // Any tracked pid no longer in the current set has ended.
        foreach (var (pid, tracked) in _tracked.ToList())
        {
            if (!currentPids.Contains(pid))
            {
                _tracked.Remove(pid);
                _queue.Enqueue(QueueEventType.GameEnded, tracked.ExeName, tracked.WindowTitle);
                Log.Info($"Game ended: {tracked.ExeName} (pid {pid}) — \"{tracked.WindowTitle}\"");
            }
        }
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

    record TrackedProcess(int Pid, string ExeName, string WindowTitle);
}
