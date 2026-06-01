// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Agon.Agent.Api;
using Agon.Agent.Auth;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Queue;

/// <summary>
/// Periodically drains the event queue and sends events to the API.
///
/// Only runs while authenticated. Pauses on 401 and signals AuthManager.
/// Uses exponential backoff per event on transient failures.
/// Merges game_started that follow a recent game_ended for the same exe.
///
/// A pending journey is only created on the API once the game ends, so the
/// UI only shows journeys with a real duration.
/// </summary>
sealed class QueueProcessor(EventQueue queue, IAgonClient client, IAuthState auth) : IDisposable
{
    static readonly TimeSpan DrainInterval = TimeSpan.FromSeconds(30);
    static readonly TimeSpan MergeThreshold = TimeSpan.FromMinutes(10);
    static readonly TimeSpan[] Backoff =
    [
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(10),
        TimeSpan.FromMinutes(30),
    ];

    // Tracks the start time of sessions detected so far (no API call yet).
    readonly Dictionary<string, DateTimeOffset> _activeSessions = []; // exeName → startedAt

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
            {
                queue.Evict();
                await DrainAsync(ct);
            }

            await Task.Delay(DrainInterval, ct).ConfigureAwait(false);
        }
    }

    internal async Task DrainAsync(CancellationToken ct = default)
    {
        var events = queue.Peek();
        foreach (var ev in events)
        {
            if (ct.IsCancellationRequested) break;

            // Respect backoff — skip events that have failed recently.
            if (ev.Attempts > 0)
            {
                var backoff = Backoff[Math.Min(ev.Attempts - 1, Backoff.Length - 1)];
                if (DateTimeOffset.UtcNow - ev.OccurredAt < backoff)
                    continue;
            }

            var handled = ev.Type switch
            {
                QueueEventType.GameStarted => await HandleGameStarted(ev, ct),
                QueueEventType.GameEnded   => await HandleGameEnded(ev, ct),
                _ => true,
            };

            if (handled)
                queue.Delete(ev.Id);
            else
                queue.IncrementAttempts(ev.Id);
        }
    }

    async Task<bool> HandleGameStarted(QueueEvent ev, CancellationToken ct)
    {
        // Check for a merge candidate — a recent game_ended for the same exe.
        var mergeId = queue.FindMergeCandidate(ev.ExeName, MergeThreshold);
        if (mergeId.HasValue)
        {
            Log.Info($"Merging game_started for {ev.ExeName} with recent game_ended (gap < {MergeThreshold.TotalMinutes}min)");
            queue.Delete(mergeId.Value);
            // Session continues — keep the original start time already in _activeSessions.
            return true;
        }

        // Track start time locally. No API call until the game ends.
        _activeSessions[ev.ExeName] = ev.OccurredAt;
        Log.Info($"Session started: {ev.ExeName} at {ev.OccurredAt:HH:mm:ss}Z");
        return true;
    }

    async Task<bool> HandleGameEnded(QueueEvent ev, CancellationToken ct)
    {
        if (!_activeSessions.TryGetValue(ev.ExeName, out var startedAt))
        {
            // No tracked start — game was running before the agent started, or agent reconnected.
            Log.Warn($"No tracked session for {ev.ExeName}, discarding game_ended");
            return true;
        }

        Log.Info($"Creating journey: {ev.ExeName} — \"{ev.WindowTitle}\" ({startedAt:HH:mm:ss}Z → {ev.OccurredAt:HH:mm:ss}Z)");
        var result = await client.CreatePendingJourneyAsync(ev.ExeName, ev.WindowTitle, startedAt, ev.OccurredAt);

        if (result.Status == ApiResult.Unauthorized)
        {
            auth.OnUnauthorized();
            return false;
        }

        if (result.Status == ApiResult.TransientFailure)
            return false;

        _activeSessions.Remove(ev.ExeName);

        if (result.JourneyId is null)
            Log.Info($"Journey excluded: {ev.ExeName}");
        else
            Log.Info($"Journey created: {ev.ExeName} → id={result.JourneyId}");

        return true;
    }

    public void Dispose() => Stop();
}
