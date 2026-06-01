// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Agon.Agent.Api;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Auth;

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
    readonly AgentConfig _config;
    readonly CredentialStore _store;
    readonly IAgonClient _client;

    // agon:// callbacks arrive as a second process instance passing args.
    // We listen on a named pipe so the second instance can hand off the URL.
    readonly UrlSchemeListener _listener;

    public bool IsAuthenticated { get; private set; }

    public event Action<bool>? AuthStateChanged;

    public AuthManager(AgentConfig config, CredentialStore store, IAgonClient client)
    {
        _config = config;
        _store = store;
        _client = client;
        _listener = new UrlSchemeListener(OnAgonUrl);
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
        return true;
    }

    /// <summary>
    /// Opens the browser to the agent login page and waits for the agon:// callback.
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

    public void Dispose() => _listener.Dispose();

    void OnAgonUrl(string url)
    {
        // Expected: agon://auth?token=<jwt>
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return;
        if (uri.Host != "auth") return;

        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var token = query["token"];
        if (string.IsNullOrEmpty(token))
        {
            Log.Warn($"agon://auth callback missing token parameter");
            return;
        }

        Log.Info("Received token via agon:// callback");
        _store.SaveToken(token);
        _client.SetToken(token);
        SetAuthenticated(true);
    }

    void SetAuthenticated(bool value)
    {
        IsAuthenticated = value;
        AuthStateChanged?.Invoke(value);
    }
}
