// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;
using Xunit;

namespace Yurnik.Agent.Tests;

/// <summary>
/// Covers the scenario that motivated the session/queue split:
/// a game is detected, the agent restarts (or the PC reboots) before the session
/// is closed, and the journey must still be recovered on the next run.
/// </summary>
public class RestartRecoveryTests : IDisposable
{
    readonly string _dbPath;

    public RestartRecoveryTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_recovery_{Guid.NewGuid():N}.db");
    }

    [Fact]
    public void GamePlayed_AgentRestarts_JourneyRecoveredOnNextRun()
    {
        // --- First agent run: game is detected and tracked ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);
            var queue = new EventQueue(db);

            // ProcessWatcher inserts the session when the game starts.
            sessions.Insert(1234, "game.exe", "My Game");

            // Agent shuts down before SessionMonitor runs (reboot, crash, etc.).
            // The session row persists in SQLite; the queue is empty.
            Assert.Single(sessions.GetAll());
            Assert.Empty(queue.Peek());
        }

        // --- Second agent run: game is no longer running ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);
            var queue = new EventQueue(db);

            // Simulate the pid being dead (game closed during shutdown).
            var monitor = new SessionMonitor(sessions, queue, _ => false, TimeSpan.Zero);
            monitor.Check();

            // Session row is gone; journey is now in the outbox.
            Assert.Empty(sessions.GetAll());
            var queued = queue.Peek();
            Assert.Single(queued);
            Assert.Equal("game.exe", queued[0].ExeName);
            Assert.Equal("My Game", queued[0].WindowTitle);
        }
    }

    [Fact]
    public void GamePlayed_AgentRestarts_EndedAtIsLastHeartbeat_NotRestartTime()
    {
        var lastHeartbeat = DateTimeOffset.UtcNow.AddMinutes(-30);

        // --- First run: session recorded with a known last_running_at ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);

            sessions.Insert(1234, "game.exe", "My Game");

            // Simulate a heartbeat tick that recorded the last known time.
            using var conn = db.OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE sessions SET started_at = $started, last_running_at = $ts WHERE pid = 1234";
            cmd.Parameters.AddWithValue("$started", lastHeartbeat.AddHours(-1).ToUnixTimeSeconds());
            cmd.Parameters.AddWithValue("$ts", lastHeartbeat.ToUnixTimeSeconds());
            cmd.ExecuteNonQuery();
        }

        // --- Second run: recover the session ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);
            var queue = new EventQueue(db);

            var monitor = new SessionMonitor(sessions, queue, _ => false, TimeSpan.Zero);
            monitor.Check();

            var queued = queue.Peek()[0];
            // ended_at must be last_running_at, not the current time.
            Assert.Equal(lastHeartbeat.ToUnixTimeSeconds(), queued.EndedAt.ToUnixTimeSeconds());
        }
    }

    [Fact]
    public void TwoGames_FirstGameClosed_SecondStillRunning_OnlyFirstQueued()
    {
        // --- First run: two games detected ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);

            sessions.Insert(1, "game1.exe", "Game One");
            sessions.Insert(2, "game2.exe", "Game Two");
        }

        // --- Second run: pid 1 is dead, pid 2 is still alive ---
        {
            var db = new Database(_dbPath);
            db.Migrate();
            var sessions = new SessionStore(db);
            var queue = new EventQueue(db);

            var monitor = new SessionMonitor(sessions, queue, pid => pid == 2, TimeSpan.Zero);
            monitor.Check();

            var remainingSessions = sessions.GetAll();
            Assert.Single(remainingSessions);
            Assert.Equal("game2.exe", remainingSessions[0].ExeName);

            var queued = queue.Peek();
            Assert.Single(queued);
            Assert.Equal("game1.exe", queued[0].ExeName);
        }
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
