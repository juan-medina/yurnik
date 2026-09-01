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
    readonly TimeSpan _interval;
    readonly SessionStore _sessions;
    readonly EventQueue _queue;
    readonly Func<int, bool> _isProcessAlive;
    readonly TimeSpan _minSessionDuration;
    readonly CancellationTokenSource _cts = new();
    Task? _monitorTask;

    public SessionMonitor(SessionStore sessions, EventQueue queue, TimeSpan? minSessionDuration = null, TimeSpan? interval = null)
        : this(sessions, queue, DefaultIsProcessAlive, minSessionDuration, interval) { }

    internal SessionMonitor(SessionStore sessions, EventQueue queue, Func<int, bool> isProcessAlive, TimeSpan? minSessionDuration = null, TimeSpan? interval = null)
    {
        _sessions = sessions;
        _queue = queue;
        _isProcessAlive = isProcessAlive;
        _minSessionDuration = minSessionDuration ?? TimeSpan.FromMinutes(5);
        _interval = interval ?? _minSessionDuration;
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
            await Task.Delay(_interval, ct).ConfigureAwait(false);
        }
    }

    internal void Check()
    {
        foreach (var session in _sessions.GetAll())
        {
            if (_isProcessAlive(session.Pid))
            {
                _sessions.UpdateHeartbeat(session.Pid);
                Log.Debug($"Heartbeat: {session.ExeName} (pid {session.Pid})");
            }
            else
            {
                var duration = session.LastRunningAt - session.StartedAt;
                if (duration >= _minSessionDuration)
                {
                    Log.Info($"Session ended: {session.ExeName} (pid {session.Pid}), last seen {session.LastRunningAt:HH:mm:ss}Z");
                    _queue.Enqueue(session.ExeName, session.PathHash, session.WindowTitle, session.StartedAt, session.LastRunningAt);
                }
                else
                {
                    Log.Info($"Session discarded: {session.ExeName} ran for only {duration.TotalSeconds:F0}s (below threshold)");
                }
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
