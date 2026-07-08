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
    public Task<HeartbeatResult> HeartbeatAsync() => Task.FromResult(new HeartbeatResult(ApiResult.Ok));
    public Task<MeResult> GetMeAsync() => Task.FromResult(new MeResult(ApiResult.Ok, null, null));
    public Task<NotificationsResult> GetNotificationsAsync() => Task.FromResult(new NotificationsResult(ApiResult.Ok, new List<Notification>()));
    public Task<ExclusionsResult> GetExclusionsAsync() => Task.FromResult(new ExclusionsResult(ApiResult.Ok, []));
    public Task<InclusionsResult> GetInclusionsAsync() => Task.FromResult(new InclusionsResult(ApiResult.Ok, []));

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

    readonly DateTimeOffset _start = DateTimeOffset.UtcNow.AddHours(-1);
    readonly DateTimeOffset _end = DateTimeOffset.UtcNow;

    public QueueProcessorTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _queue = new EventQueue(_db);
        _processor = new QueueProcessor(_queue, _client, _auth);
    }

    [Fact]
    public async Task Journey_InQueue_CallsApiAndIsDeleted()
    {
        _queue.Enqueue("game.exe", "My Game", _start, _end);

        await _processor.DrainAsync();

        Assert.Single(_client.Calls);
        Assert.Equal("game.exe", _client.Calls[0].ExeName);
        Assert.Equal("My Game", _client.Calls[0].WindowTitle);
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public async Task TransientFailure_IncrementsAttempts_LeavesInQueue()
    {
        _client.NextResult = ApiResult.TransientFailure;
        _queue.Enqueue("game.exe", "My Game", _start, _end);

        await _processor.DrainAsync();

        var remaining = _queue.Peek();
        Assert.Single(remaining);
        Assert.Equal(1, remaining[0].Attempts);
    }

    [Fact]
    public async Task TwoJourneys_BothSentAndDeleted()
    {
        _queue.Enqueue("alpha.exe", "Alpha", _start, _end);
        _queue.Enqueue("beta.exe", "Beta", _start, _end);

        await _processor.DrainAsync();

        Assert.Equal(2, _client.Calls.Count);
        Assert.Empty(_queue.Peek());
    }

    [Fact]
    public async Task RateLimited_StopsAfterFirstEntry()
    {
        _client.NextResult = ApiResult.RateLimited;
        _queue.Enqueue("alpha.exe", "Alpha", _start, _end);
        _queue.Enqueue("beta.exe", "Beta", _start, _end);

        await _processor.DrainAsync();

        // Only one attempt made before circuit breaker tripped
        Assert.Single(_client.Calls);
        Assert.Equal(2, _queue.Peek().Count);
    }

    public void Dispose()
    {
        _processor.Dispose();
        try { File.Delete(_dbPath); } catch { }
    }
}
