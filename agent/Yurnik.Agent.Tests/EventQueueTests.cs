// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;
using Xunit;

namespace Yurnik.Agent.Tests;

public class EventQueueTests : IDisposable
{
    readonly Database _db;
    readonly EventQueue _queue;
    readonly string _dbPath;

    public EventQueueTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _queue = new EventQueue(_db);
    }

    [Fact]
    public void Enqueue_AddsJourney()
    {
        var start = DateTimeOffset.UtcNow.AddHours(-1);
        var end = DateTimeOffset.UtcNow;

        _queue.Enqueue("game.exe", "My Game", start, end);

        var journeys = _queue.Peek();
        Assert.Single(journeys);
        Assert.Equal("game.exe", journeys[0].ExeName);
        Assert.Equal("My Game", journeys[0].WindowTitle);
    }

    [Fact]
    public void Peek_ReturnsJourneysOrderedById()
    {
        var now = DateTimeOffset.UtcNow;
        _queue.Enqueue("alpha.exe", "Alpha", now.AddHours(-2), now.AddHours(-1));
        _queue.Enqueue("beta.exe", "Beta", now.AddHours(-1), now);

        var journeys = _queue.Peek();
        Assert.Equal(2, journeys.Count);
        Assert.Equal("alpha.exe", journeys[0].ExeName);
        Assert.Equal("beta.exe", journeys[1].ExeName);
    }

    [Fact]
    public void Delete_RemovesJourney()
    {
        _queue.Enqueue("game.exe", "Game", DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow);
        var before = _queue.Peek();
        Assert.Single(before);

        _queue.Delete(before[0].Id);

        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public void IncrementAttempts_IncrementsCounter()
    {
        _queue.Enqueue("game.exe", "Game", DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow);
        var journey = _queue.Peek()[0];
        Assert.Equal(0, journey.Attempts);

        _queue.IncrementAttempts(journey.Id);

        Assert.Equal(1, _queue.Peek()[0].Attempts);
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
