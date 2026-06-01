// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Agon.Agent.Infrastructure;
using Agon.Agent.Queue;
using Xunit;

namespace Agon.Agent.Tests;

public class EventQueueTests : IDisposable
{
    readonly Database _db;
    readonly EventQueue _queue;
    readonly string _dbPath;

    public EventQueueTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"agon_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _queue = new EventQueue(_db);
    }

    [Fact]
    public void FindMergeCandidate_ReturnsId_WhenRecentGameEndedExists()
    {
        _queue.Enqueue(QueueEventType.GameEnded, "eldenring.exe", "ELDEN RING");

        var id = _queue.FindMergeCandidate("eldenring.exe", TimeSpan.FromMinutes(10));

        Assert.NotNull(id);
    }

    [Fact]
    public void FindMergeCandidate_ReturnsNull_WhenNoGameEndedExists()
    {
        var id = _queue.FindMergeCandidate("eldenring.exe", TimeSpan.FromMinutes(10));

        Assert.Null(id);
    }

    [Fact]
    public void FindMergeCandidate_ReturnsNull_ForDifferentExe()
    {
        _queue.Enqueue(QueueEventType.GameEnded, "eldenring.exe", "ELDEN RING");

        var id = _queue.FindMergeCandidate("witcher3.exe", TimeSpan.FromMinutes(10));

        Assert.Null(id);
    }

    [Fact]
    public void FindMergeCandidate_ReturnsNull_ForGameStarted_NotGameEnded()
    {
        _queue.Enqueue(QueueEventType.GameStarted, "eldenring.exe", "ELDEN RING");

        var id = _queue.FindMergeCandidate("eldenring.exe", TimeSpan.FromMinutes(10));

        Assert.Null(id);
    }

    [Fact]
    public void Peek_ExcludesEventsOlderThanTtl()
    {
        // Insert directly with an old timestamp via raw SQL to simulate a stale event.
        using var conn = _db.OpenConnection();
        using var cmd = conn.CreateCommand();
        var oldTimestamp = DateTimeOffset.UtcNow.AddDays(-4).ToUnixTimeSeconds();
        cmd.CommandText = """
            INSERT INTO queue (type, exe_name, payload, created_at)
            VALUES ('GameStarted', 'old.exe', '{}', $ts)
            """;
        cmd.Parameters.AddWithValue("$ts", oldTimestamp);
        cmd.ExecuteNonQuery();

        var events = _queue.Peek();

        Assert.Empty(events);
    }

    [Fact]
    public void Delete_RemovesEvent()
    {
        _queue.Enqueue(QueueEventType.GameStarted, "game.exe", "Game");
        var before = _queue.Peek();
        Assert.Single(before);

        _queue.Delete(before[0].Id);

        Assert.Empty(_queue.Peek());
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
