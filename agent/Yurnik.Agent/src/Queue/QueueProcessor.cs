// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Api;
using Yurnik.Agent.Auth;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Queue;

/// <summary>
/// Periodically drains the journey outbox and sends entries to the API.
/// Only runs while authenticated. Pauses on 401 and signals AuthManager.
/// Uses exponential backoff per entry on transient failures.
/// </summary>
sealed class QueueProcessor(EventQueue queue, IYurnikClient client, IAuthState auth) : IDisposable
{
    static readonly TimeSpan DrainInterval = TimeSpan.FromMinutes(15);
    static readonly TimeSpan RateLimitCooldown = TimeSpan.FromMinutes(5);
    static readonly TimeSpan[] Backoff =
    [
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(10),
        TimeSpan.FromMinutes(30),
    ];

    DateTimeOffset? _rateLimitedUntil;

    readonly CancellationTokenSource _cts = new();
    Task? _drainTask;

    public void Start()
    {
        _drainTask = DrainLoopAsync(_cts.Token);
        Log.Info("QueueProcessor started");
    }

    public void Stop()
    {
        _cts.Cancel();
        try { _drainTask?.Wait(5000); }
        catch (AggregateException) { }
        Log.Info("QueueProcessor stopped");
    }

    async Task DrainLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            if (auth.IsAuthenticated)
                await DrainAsync(ct);

            await Task.Delay(DrainInterval, ct).ConfigureAwait(false);
        }
    }

    internal async Task DrainAsync(CancellationToken ct = default)
    {
        if (_rateLimitedUntil is { } until && DateTimeOffset.UtcNow < until)
        {
            Log.Info($"Rate limited — drain skipped until {until:HH:mm:ss}Z");
            return;
        }
        _rateLimitedUntil = null;

        foreach (var journey in queue.Peek())
        {
            if (ct.IsCancellationRequested) break;

            if (journey.Attempts > 0)
            {
                var backoff = Backoff[Math.Min(journey.Attempts - 1, Backoff.Length - 1)];
                if (DateTimeOffset.UtcNow - journey.EndedAt < backoff)
                    continue;
            }

            var result = await client.CreatePendingJourneyAsync(
                journey.ExeName, journey.WindowTitle, journey.StartedAt, journey.EndedAt);

            if (result.Status == ApiResult.Unauthorized)
            {
                auth.OnUnauthorized();
                return;
            }

            if (result.Status == ApiResult.RateLimited)
            {
                _rateLimitedUntil = DateTimeOffset.UtcNow + RateLimitCooldown;
                Log.Warn($"Rate limited — pausing drain until {_rateLimitedUntil:HH:mm:ss}Z");
                return;
            }

            if (result.Status == ApiResult.TransientFailure)
            {
                queue.IncrementAttempts(journey.Id);
                continue;
            }

            queue.Delete(journey.Id);

            if (result.JourneyId is null)
                Log.Info($"Journey excluded: {journey.ExeName}");
            else
                Log.Info($"Journey created: {journey.ExeName} → id={result.JourneyId}");
        }
    }

    public void Dispose() => Stop();
}
