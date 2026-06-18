// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;
using Xunit;

namespace Yurnik.Agent.Tests;

public class SessionMonitorTests : IDisposable
{
    readonly Database _db;
    readonly SessionStore _sessions;
    readonly EventQueue _queue;
    readonly string _dbPath;

    public SessionMonitorTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _sessions = new SessionStore(_db);
        _queue = new EventQueue(_db);
    }

    [Fact]
    public void AliveProcess_UpdatesHeartbeat_StaysInSessions()
    {
        _sessions.Insert(1234, "game.exe", "My Game");
        var before = _sessions.GetAll()[0].LastRunningAt;

        var monitor = new SessionMonitor(_sessions, _queue, _ => true);
        monitor.Check();

        var after = _sessions.GetAll()[0].LastRunningAt;
        Assert.True(after >= before);
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public void DeadProcess_MovesToQueue_RemovedFromSessions()
    {
        _sessions.Insert(1234, "game.exe", "My Game");

        var monitor = new SessionMonitor(_sessions, _queue, _ => false);
        monitor.Check();

        Assert.Empty(_sessions.GetAll());
        var queued = _queue.Peek();
        Assert.Single(queued);
        Assert.Equal("game.exe", queued[0].ExeName);
        Assert.Equal("My Game", queued[0].WindowTitle);
    }

    [Fact]
    public void DeadProcess_EndedAt_IsLastRunningAt_NotNow()
    {
        _sessions.Insert(1234, "game.exe", "My Game");
        var lastSeen = _sessions.GetAll()[0].LastRunningAt;

        var monitor = new SessionMonitor(_sessions, _queue, _ => false);
        monitor.Check();

        var queued = _queue.Peek()[0];
        // ended_at should match last_running_at, not drift toward now
        Assert.Equal(lastSeen.ToUnixTimeSeconds(), queued.EndedAt.ToUnixTimeSeconds());
    }

    [Fact]
    public void EmptySessions_DoesNothing()
    {
        var monitor = new SessionMonitor(_sessions, _queue, _ => true);
        monitor.Check();

        Assert.Empty(_sessions.GetAll());
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public void TwoSessions_OneAliveOneDeadHandledIndependently()
    {
        _sessions.Insert(1, "alive.exe", "Alive Game");
        _sessions.Insert(2, "dead.exe", "Dead Game");

        var monitor = new SessionMonitor(_sessions, _queue, pid => pid == 1);
        monitor.Check();

        var remaining = _sessions.GetAll();
        Assert.Single(remaining);
        Assert.Equal("alive.exe", remaining[0].ExeName);

        var queued = _queue.Peek();
        Assert.Single(queued);
        Assert.Equal("dead.exe", queued[0].ExeName);
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
