// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Diagnostics;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Periodically checks running sessions against live OS processes.
/// Alive sessions get a heartbeat update; dead ones are moved to the outbox queue.
/// This design survives restarts and shutdowns — ended_at is last_running_at, not "now".
/// </summary>
sealed class SessionMonitor : IDisposable
{
    static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    readonly SessionStore _sessions;
    readonly EventQueue _queue;
    readonly Func<int, bool> _isProcessAlive;
    readonly CancellationTokenSource _cts = new();
    Task? _monitorTask;

    public SessionMonitor(SessionStore sessions, EventQueue queue)
        : this(sessions, queue, DefaultIsProcessAlive) { }

    internal SessionMonitor(SessionStore sessions, EventQueue queue, Func<int, bool> isProcessAlive)
    {
        _sessions = sessions;
        _queue = queue;
        _isProcessAlive = isProcessAlive;
    }

    public void Start()
    {
        _monitorTask = MonitorLoopAsync(_cts.Token);
        Log.Info("SessionMonitor started");
    }

    public void Stop()
    {
        _cts.Cancel();
        try { _monitorTask?.Wait(5000); }
        catch (AggregateException) { }
        Log.Info("SessionMonitor stopped");
    }

    async Task MonitorLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            Check();
            await Task.Delay(Interval, ct).ConfigureAwait(false);
        }
    }

    internal void Check()
    {
        foreach (var session in _sessions.GetAll())
        {
            if (_isProcessAlive(session.Pid))
            {
                _sessions.UpdateHeartbeat(session.Pid);
                Log.Info($"Heartbeat: {session.ExeName} (pid {session.Pid})");
            }
            else
            {
                Log.Info($"Session ended: {session.ExeName} (pid {session.Pid}), last seen {session.LastRunningAt:HH:mm:ss}Z");
                _queue.Enqueue(session.ExeName, session.WindowTitle, session.StartedAt, session.LastRunningAt);
                _sessions.Delete(session.Pid);
            }
        }
    }

    static bool DefaultIsProcessAlive(int pid)
    {
        try
        {
            var p = Process.GetProcessById(pid);
            return !p.HasExited;
        }
        catch { return false; }
    }

    public void Dispose() => Stop();
}
