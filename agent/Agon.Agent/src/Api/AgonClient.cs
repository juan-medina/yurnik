// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Api;

enum ApiResult { Ok, Unauthorized, TransientFailure }

record CreatePendingResult(ApiResult Status, string? JourneyId);

/// <summary>
/// Typed HTTP client for the Agon API.
/// Returns result types — never throws for expected failures.
/// Caller is responsible for backoff; this class does not retry.
/// </summary>
sealed class AgonClient(string baseUrl) : IAgonClient
{
    readonly HttpClient _http = new() { BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/") };

    public void SetToken(string token)
    {
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
    }

    public void ClearToken()
    {
        _http.DefaultRequestHeaders.Authorization = null;
    }

    /// <summary>
    /// Validates the current token. Returns false on 401 or network failure.
    /// </summary>
    public async Task<bool> HeartbeatAsync()
    {
        try
        {
            var resp = await _http.PostAsync("api/v1/agent/heartbeat", null);
            return resp.StatusCode != HttpStatusCode.Unauthorized;
        }
        catch (Exception ex)
        {
            Log.Error("Heartbeat failed", ex);
            return false;
        }
    }

    /// <summary>
    /// Creates a completed pending journey. Both timestamps are known at call time
    /// so the journey is created in 'ended' state and appears in the web UI immediately.
    /// Returns null JourneyId when the exe is excluded (204 from server).
    /// </summary>
    public async Task<CreatePendingResult> CreatePendingJourneyAsync(
        string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt)
    {
        var body = JsonSerializer.Serialize(new
        {
            exe_name = exeName,
            window_title = windowTitle,
            started_at = startedAt.UtcDateTime.ToString("O"),
            ended_at = endedAt.UtcDateTime.ToString("O"),
        });

        try
        {
            var resp = await _http.PostAsync("api/v1/agent/pending-journeys",
                new StringContent(body, Encoding.UTF8, "application/json"));

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
                return new CreatePendingResult(ApiResult.Unauthorized, null);

            // 204 = exe excluded by the user — silently skip
            if (resp.StatusCode == HttpStatusCode.NoContent)
                return new CreatePendingResult(ApiResult.Ok, null);

            if (!resp.IsSuccessStatusCode)
            {
                Log.Warn($"CreatePendingJourney: unexpected status {resp.StatusCode}");
                return new CreatePendingResult(ApiResult.TransientFailure, null);
            }

            var json = await resp.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var id = doc.RootElement.GetProperty("id").GetString();
            return new CreatePendingResult(ApiResult.Ok, id);
        }
        catch (Exception ex)
        {
            Log.Error("CreatePendingJourney failed", ex);
            return new CreatePendingResult(ApiResult.TransientFailure, null);
        }
    }
}
