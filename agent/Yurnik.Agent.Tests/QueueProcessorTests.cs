// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Api;
using Yurnik.Agent.Auth;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;
using Xunit;

namespace Yurnik.Agent.Tests;

class FakeAuthState : IAuthState
{
    public bool IsAuthenticated { get; set; } = true;
    public void OnUnauthorized() { }
}

class FakeYurnikClient : IYurnikClient
{
    public record Call(string ExeName, string WindowTitle, DateTimeOffset StartedAt, DateTimeOffset EndedAt);

    public List<Call> Calls { get; } = [];
    public ApiResult NextResult { get; set; } = ApiResult.Ok;

    public void SetToken(string token) { }
    public void ClearToken() { }
    public Task<HeartbeatResult> HeartbeatAsync() => Task.FromResult(new HeartbeatResult(true));

    public Task<CreatePendingResult> CreatePendingJourneyAsync(
        string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt)
    {
        Calls.Add(new Call(exeName, windowTitle, startedAt, endedAt));
        var id = NextResult == ApiResult.Ok ? "journey-id" : null;
        return Task.FromResult(new CreatePendingResult(NextResult, id));
    }
}

public class QueueProcessorTests : IDisposable
{
    readonly Database _db;
    readonly EventQueue _queue;
    readonly FakeYurnikClient _client = new();
    readonly FakeAuthState _auth = new();
    readonly QueueProcessor _processor;
    readonly string _dbPath;

    public QueueProcessorTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _queue = new EventQueue(_db);
        _processor = new QueueProcessor(_queue, _client, _auth);
    }

    [Fact]
    public async Task GameStarted_IsConsumedWithoutApiCall()
    {
        _queue.Enqueue(QueueEventType.GameStarted, "game.exe", "My Game");

        await _processor.DrainAsync();

        Assert.Empty(_client.Calls);
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public async Task GameEnded_AfterGameStarted_CallsApiWithBothTimestamps()
    {
        _queue.Enqueue(QueueEventType.GameStarted, "game.exe", "My Game");
        await _processor.DrainAsync();

        _queue.Enqueue(QueueEventType.GameEnded, "game.exe", "My Game");
        await _processor.DrainAsync();

        Assert.Single(_client.Calls);
        Assert.Empty(_queue.Peek());

        var call = _client.Calls[0];
        Assert.Equal("game.exe", call.ExeName);
        Assert.Equal("My Game", call.WindowTitle);
        Assert.True(call.EndedAt >= call.StartedAt);
    }

    [Fact]
    public async Task GameEnded_WithNoTrackedStart_IsDiscardedWithoutApiCall()
    {
        // Game was running when the agent started — no GameStarted was ever processed.
        _queue.Enqueue(QueueEventType.GameEnded, "game.exe", "My Game");

        await _processor.DrainAsync();

        Assert.Empty(_client.Calls);
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public async Task TwoGames_TrackIndependently()
    {
        _queue.Enqueue(QueueEventType.GameStarted, "alpha.exe", "Alpha");
        _queue.Enqueue(QueueEventType.GameStarted, "beta.exe", "Beta");
        await _processor.DrainAsync();

        _queue.Enqueue(QueueEventType.GameEnded, "alpha.exe", "Alpha");
        await _processor.DrainAsync();

        Assert.Single(_client.Calls);
        Assert.Equal("alpha.exe", _client.Calls[0].ExeName);

        _queue.Enqueue(QueueEventType.GameEnded, "beta.exe", "Beta");
        await _processor.DrainAsync();

        Assert.Equal(2, _client.Calls.Count);
        Assert.Equal("beta.exe", _client.Calls[1].ExeName);
    }

    [Fact]
    public async Task GameEnded_OnTransientFailure_RemainsInQueue()
    {
        _client.NextResult = ApiResult.TransientFailure;

        _queue.Enqueue(QueueEventType.GameStarted, "game.exe", "My Game");
        await _processor.DrainAsync();

        _queue.Enqueue(QueueEventType.GameEnded, "game.exe", "My Game");
        await _processor.DrainAsync();

        // API failed — event still in queue (attempts incremented for backoff)
        var remaining = _queue.Peek();
        Assert.Single(remaining);
        Assert.Equal(QueueEventType.GameEnded, remaining[0].Type);
        Assert.Equal(1, remaining[0].Attempts);
    }

    public void Dispose()
    {
        _processor.Dispose();
        try { File.Delete(_dbPath); } catch { }
    }
}
