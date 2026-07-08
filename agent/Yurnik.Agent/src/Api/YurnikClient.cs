// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Api;

enum ApiResult { Ok, Unauthorized, TransientFailure, RateLimited }

record CreatePendingResult(ApiResult Status, string? JourneyId);
record NotificationPreferences(bool Updates, bool Notifications);
record MeResult(ApiResult Status, string? Handle, string? Name, NotificationPreferences? NotificationPreferences = null);
record ExclusionsResult(ApiResult Status, List<string>? ExeNames);
record InclusionsResult(ApiResult Status, List<string>? ExeNames);
record Notification(string Id, string Type, int ActorCount, string? SubjectTitle, bool Read);
record NotificationsResult(ApiResult Status, List<Notification>? Notifications);

/// <summary>
/// Returned by HeartbeatAsync. Status distinguishes a rejected token (Unauthorized)
/// from a transient problem (TransientFailure, RateLimited) that should be retried
/// without clearing credentials.
/// NewToken is set when the server issued a fresh token (token was older than 24h).
/// </summary>
record HeartbeatResult(ApiResult Status, string? NewToken = null)
{
    public bool Valid => Status == ApiResult.Ok;
}

/// <summary>
/// Typed HTTP client for the Yurnik API.
/// Returns result types — never throws for expected failures.
/// Caller is responsible for backoff; this class does not retry.
/// </summary>
sealed class YurnikClient : IYurnikClient
{
    readonly HttpClient _http;

    public YurnikClient(string baseUrl, HttpMessageHandler? handler = null)
    {
        _http = handler != null ? new HttpClient(handler) : new HttpClient();
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"YurnikAgent/{AgentVersion()}");
    }

    static string AgentVersion()
    {
        var v = typeof(YurnikClient).Assembly
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .OfType<System.Reflection.AssemblyInformationalVersionAttribute>()
            .FirstOrDefault()?.InformationalVersion ?? "unknown";
        var plus = v.IndexOf('+');
        return plus >= 0 ? v[..plus] : v;
    }

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
    /// Validates the current token. Returns Valid=false on 401 or network failure.
    /// Returns NewToken when the server issued a fresh token (token age > 24h).
    /// </summary>
    public async Task<HeartbeatResult> HeartbeatAsync()
    {
        try
        {
            var resp = await _http.PostAsync("api/v1/agent/heartbeat", null);

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Info("Heartbeat unauthorized, token expired or revoked");
                return new HeartbeatResult(ApiResult.Unauthorized);
            }

            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                Log.Warn("Heartbeat rate limited");
                return new HeartbeatResult(ApiResult.RateLimited);
            }

            if (resp.StatusCode == HttpStatusCode.OK)
            {
                var json = await resp.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                var newToken = doc.RootElement.GetProperty("token").GetString();
                return new HeartbeatResult(ApiResult.Ok, newToken);
            }

            // 204 — valid, no renewal needed
            return new HeartbeatResult(ApiResult.Ok);
        }
        catch (Exception ex)
        {
            Log.Error("Heartbeat failed", ex);
            return new HeartbeatResult(ApiResult.TransientFailure);
        }
    }

    public async Task<MeResult> GetMeAsync()
    {
        try
        {
            var resp = await _http.GetAsync("api/me");

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Warn("GetMe unauthorized");
                return new MeResult(ApiResult.Unauthorized, null, null);
            }

            if (!resp.IsSuccessStatusCode)
            {
                Log.Warn($"GetMe: unexpected status {resp.StatusCode}");
                return new MeResult(ApiResult.TransientFailure, null, null);
            }

            var json = await resp.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var handle = doc.RootElement.GetProperty("handle").GetString();
            var name = doc.RootElement.GetProperty("name").GetString();
            NotificationPreferences? prefs = null;
            if (doc.RootElement.TryGetProperty("notification_preferences", out var p) && p.ValueKind == JsonValueKind.Object)
            {
                var updates = p.TryGetProperty("updates", out var u) && u.GetBoolean();
                var notifications = p.TryGetProperty("notifications", out var e) && e.GetBoolean();
                prefs = new NotificationPreferences(updates, notifications);
            }
            return new MeResult(ApiResult.Ok, handle, name, prefs);
        }
        catch (Exception ex)
        {
            Log.Error("GetMe failed", ex);
            return new MeResult(ApiResult.TransientFailure, null, null);
        }
    }

    /// <summary>
    /// Returns the user's exe exclusion list, so the agent can cache it locally
    /// and skip known non-games without round-tripping for every detection.
    /// </summary>
    public async Task<ExclusionsResult> GetExclusionsAsync()
    {
        try
        {
            var resp = await _http.GetAsync("api/v1/agent/exclusions");

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Warn("GetExclusions unauthorized");
                return new ExclusionsResult(ApiResult.Unauthorized, null);
            }

            if (!resp.IsSuccessStatusCode)
            {
                Log.Warn($"GetExclusions: unexpected status {resp.StatusCode}");
                return new ExclusionsResult(ApiResult.TransientFailure, null);
            }

            var json = await resp.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var exeNames = doc.RootElement.GetProperty("exclusions")
                .EnumerateArray()
                .Select(e => e.GetString())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!)
                .ToList();
            return new ExclusionsResult(ApiResult.Ok, exeNames);
        }
        catch (Exception ex)
        {
            Log.Error("GetExclusions failed", ex);
            return new ExclusionsResult(ApiResult.TransientFailure, null);
        }
    }

    public async Task<InclusionsResult> GetInclusionsAsync()
    {
        try
        {
            var resp = await _http.GetAsync("api/v1/agent/inclusions");

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Warn("GetInclusions unauthorized");
                return new InclusionsResult(ApiResult.Unauthorized, null);
            }

            if (!resp.IsSuccessStatusCode)
            {
                Log.Warn($"GetInclusions: unexpected status {resp.StatusCode}");
                return new InclusionsResult(ApiResult.TransientFailure, null);
            }

            var json = await resp.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var exeNames = doc.RootElement.GetProperty("inclusions")
                .EnumerateArray()
                .Select(e => e.GetString())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s!)
                .ToList();
            return new InclusionsResult(ApiResult.Ok, exeNames);
        }
        catch (Exception ex)
        {
            Log.Error("GetInclusions failed", ex);
            return new InclusionsResult(ApiResult.TransientFailure, null);
        }
    }

    public async Task<NotificationsResult> GetNotificationsAsync()
    {
        try
        {
            var resp = await _http.GetAsync("api/notifications");

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
            {
                Log.Warn("GetNotifications unauthorized");
                return new NotificationsResult(ApiResult.Unauthorized, null);
            }

            if (!resp.IsSuccessStatusCode)
            {
                Log.Warn($"GetNotifications: unexpected status {resp.StatusCode}");
                return new NotificationsResult(ApiResult.TransientFailure, null);
            }

            var json = await resp.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var notifications = new List<Notification>();
            foreach (var e in doc.RootElement.GetProperty("notifications").EnumerateArray())
            {
                notifications.Add(new Notification(
                    Id: e.GetProperty("id").GetInt64().ToString(),
                    Type: e.GetProperty("type").GetString()!,
                    ActorCount: e.GetProperty("actor_count").GetInt32(),
                    SubjectTitle: e.TryGetProperty("subject_title", out var st) && st.ValueKind == JsonValueKind.String ? st.GetString() : null,
                    Read: e.GetProperty("read").GetBoolean()
                ));
            }
            return new NotificationsResult(ApiResult.Ok, notifications);
        }
        catch (Exception ex)
        {
            Log.Error("GetNotifications failed", ex);
            return new NotificationsResult(ApiResult.TransientFailure, null);
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
            {
                Log.Warn("CreatePendingJourney unauthorized");
                return new CreatePendingResult(ApiResult.Unauthorized, null);
            }

            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                Log.Warn("CreatePendingJourney rate limited");
                return new CreatePendingResult(ApiResult.RateLimited, null);
            }

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
