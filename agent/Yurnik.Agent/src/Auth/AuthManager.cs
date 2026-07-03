// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Api;
using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Auth;

/// <summary>
/// Owns the agent authentication lifecycle.
///
/// States:
///   Unauthenticated  — no token, waiting for user to complete browser login
///   Authenticated    — token present and accepted by the API
///   ReauthRequired   — token rejected (401), waiting for user to re-login
///
/// Other components observe <see cref="IsAuthenticated"/> and subscribe to
/// <see cref="AuthStateChanged"/> to know when to start or pause.
/// </summary>
sealed class AuthManager : IAuthState, IDisposable
{
    // Backoff applied when a refresh check fails transiently (network error or
    // 429). A rejected token (401) is handled immediately, not via this table.
    static readonly TimeSpan[] RefreshBackoff =
    [
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(10),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromHours(2),
    ];

    readonly AgentConfig _config;
    readonly CredentialStore _store;
    readonly IYurnikClient _client;
    readonly ExclusionStore _exclusions;
    readonly InclusionStore _inclusions;

    // yurnik:// callbacks arrive as a second process instance passing args.
    // We listen on a named pipe so the second instance can hand off the URL.
    readonly UrlSchemeListener _listener;

    readonly CancellationTokenSource _cts = new();
    Task? _refreshTask;

    public bool IsAuthenticated { get; private set; }

    public event Action<bool>? AuthStateChanged;

    public AuthManager(AgentConfig config, CredentialStore store, IYurnikClient client, ExclusionStore exclusions, InclusionStore inclusions)
    {
        _config = config;
        _store = store;
        _client = client;
        _exclusions = exclusions;
        _inclusions = inclusions;
        _listener = new UrlSchemeListener(OnYurnikUrl);
    }

    /// <summary>
    /// Called on startup. Checks the credential store and validates the token
    /// against the API. Returns true if ready to operate.
    /// </summary>
    public async Task<bool> InitialiseAsync()
    {
        var token = _store.LoadToken();
        if (token is null)
        {
            Log.Info("No token found in credential store");
            return false;
        }

        _client.SetToken(token);

        var heartbeat = await _client.HeartbeatAsync();
        if (!heartbeat.Valid)
        {
            Log.Warn("Stored token rejected by API — clearing");
            _store.DeleteToken();
            _client.ClearToken();
            return false;
        }

        if (heartbeat.NewToken is not null)
        {
            Log.Info("Token renewed");
            _store.SaveToken(heartbeat.NewToken);
            _client.SetToken(heartbeat.NewToken);
        }

        Log.Info("Token validated — authenticated");
        SetAuthenticated(true);
        await SyncSettingsAsync();
        return true;
    }

    /// <summary>
    /// Starts the periodic session-refresh loop. Safe to call once at startup;
    /// the loop is a no-op while unauthenticated.
    /// </summary>
    public void Start()
    {
        _refreshTask = RefreshLoopAsync(_cts.Token);
        Log.Info("Session refresh loop started");
        Log.Debug($"Session refresh interval: {_config.SyncInterval}");
    }

    /// <summary>
    /// Opens the browser to the agent login page and waits for the yurnik:// callback.
    /// </summary>
    public void StartLoginFlow()
    {
        Log.Info("Starting login flow");
        var url = $"{_config.WebBaseUrl}/auth/agent";
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url)
        {
            UseShellExecute = true
        });
    }

    /// <summary>
    /// Called by the QueueProcessor when the API returns 401.
    /// Clears the bad token and signals re-auth needed.
    /// </summary>
    public void OnUnauthorized()
    {
        Log.Warn("Received 401 — token invalid, clearing and requesting re-auth");
        _store.DeleteToken();
        _client.ClearToken();
        SetAuthenticated(false);
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _refreshTask?.Wait(5000); }
        catch (AggregateException) { }
        _listener.Dispose();
    }

    /// <summary>
    /// Periodically re-validates the stored token so a continuously running
    /// agent never hits the 7-day session expiry. Backs off on transient
    /// failures; a rejected token (401) moves straight to ReauthRequired.
    /// </summary>
    async Task RefreshLoopAsync(CancellationToken ct)
    {
        var delay = _config.SyncInterval;
        var failures = 0;

        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(delay, ct); }
            catch (OperationCanceledException) { break; }

            if (!IsAuthenticated)
            {
                Log.Debug("Session refresh: not authenticated, skipping check");
                delay = _config.SyncInterval;
                continue;
            }

            Log.Debug("Session refresh: checking heartbeat");
            var heartbeat = await _client.HeartbeatAsync();
            switch (heartbeat.Status)
            {
                case ApiResult.Ok:
                    if (heartbeat.NewToken is not null)
                    {
                        Log.Info("Token renewed");
                        _store.SaveToken(heartbeat.NewToken);
                        _client.SetToken(heartbeat.NewToken);
                    }
                    else
                    {
                        Log.Debug("Session refresh: token still valid, no renewal needed");
                    }
                    await SyncSettingsAsync();
                    failures = 0;
                    delay = _config.SyncInterval;
                    break;

                case ApiResult.Unauthorized:
                    Log.Warn("Session refresh: token rejected — clearing and requesting re-auth");
                    _store.DeleteToken();
                    _client.ClearToken();
                    failures = 0;
                    delay = _config.SyncInterval;
                    SetAuthenticated(false);
                    break;

                default: // TransientFailure, RateLimited
                    delay = RefreshBackoff[Math.Min(failures, RefreshBackoff.Length - 1)];
                    failures++;
                    Log.Warn($"Session refresh check failed ({heartbeat.Status}) — retrying in {delay}");
                    break;
            }

            Log.Debug($"Session refresh: next check in {delay}");
        }
    }

    void OnYurnikUrl(string url)
    {
        // Expected: yurnik://auth?token=<jwt>
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return;
        if (uri.Host != "auth") return;

        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var token = query["token"];
        if (string.IsNullOrEmpty(token))
        {
            Log.Warn($"yurnik://auth callback missing token parameter");
            return;
        }

        Log.Info("Received token via yurnik:// callback");
        _store.SaveToken(token);
        _client.SetToken(token);
        SetAuthenticated(true);
        _ = SyncSettingsAsync();
    }

    void SetAuthenticated(bool value)
    {
        IsAuthenticated = value;
        AuthStateChanged?.Invoke(value);
    }

    /// <summary>
    /// Refreshes the local settings cache from the API. Best-effort — a
    /// failure here just means the cache stays stale until the next sync
    /// (login or heartbeat), not a fatal error for the agent.
    /// </summary>
    public event Action? SettingsSynced;

    public async Task SyncSettingsAsync()
    {
        bool changed = false;

        var excResult = await _client.GetExclusionsAsync();
        if (excResult.Status == ApiResult.Ok && excResult.ExeNames is not null)
        {
            _exclusions.ReplaceAll(excResult.ExeNames);
            Log.Info($"Exclusion list synced: {excResult.ExeNames.Count} entries");
            changed = true;
        }
        else
        {
            Log.Warn($"Exclusion sync skipped: {excResult.Status}");
        }

        var incResult = await _client.GetInclusionsAsync();
        if (incResult.Status == ApiResult.Ok && incResult.ExeNames is not null)
        {
            _inclusions.ReplaceAll(incResult.ExeNames);
            Log.Info($"Inclusion list synced: {incResult.ExeNames.Count} entries");
            changed = true;
        }
        else
        {
            Log.Warn($"Inclusion sync skipped: {incResult.Status}");
        }

        if (changed)
        {
            SettingsSynced?.Invoke();
        }
    }
}
