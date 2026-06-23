// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Text.Json;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Caches Discord's public "detectable games" executable list
/// (GET https://discordapp.com/api/v9/applications/detectable) on disk and
/// refreshes it once a day. This is a zero-privilege signal that a running
/// exe is a known game — no module/DLL inspection of the live process
/// required, so it works even when the target is elevated or protected by
/// anti-cheat.
/// </summary>
sealed class DetectableGamesCache : IDisposable
{
    const string DetectableUrl = "https://discordapp.com/api/v9/applications/detectable";

    static readonly TimeSpan RefreshInterval = TimeSpan.FromHours(24);
    static readonly TimeSpan[] RetryBackoff =
    [
        TimeSpan.FromMinutes(10),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
    ];

    readonly string _cachePath;
    readonly HttpClient _http = new();
    readonly CancellationTokenSource _cts = new();

    HashSet<string> _exeNames = [];
    Task? _refreshTask;

    public DetectableGamesCache(string cachePath)
    {
        _cachePath = cachePath;
        LoadFromDisk();
    }

    public bool IsKnownGame(string exeName) => _exeNames.Contains(exeName.ToLowerInvariant());

    public void Start()
    {
        _refreshTask = RefreshLoopAsync(_cts.Token);
        Log.Info("DetectableGamesCache started");
    }

    public void Stop()
    {
        _cts.Cancel();
        try { _refreshTask?.Wait(5000); }
        catch (AggregateException) { }
    }

    async Task RefreshLoopAsync(CancellationToken ct)
    {
        var delay = DueDelay();
        var failures = 0;

        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(delay, ct); }
            catch (OperationCanceledException) { break; }

            if (await TryRefreshAsync())
            {
                failures = 0;
                delay = RefreshInterval;
            }
            else
            {
                delay = RetryBackoff[Math.Min(failures, RetryBackoff.Length - 1)];
                failures++;
            }
        }
    }

    // On startup, only fetch immediately if the cache is missing or stale —
    // avoids hitting Discord's endpoint on every agent restart.
    TimeSpan DueDelay()
    {
        if (!File.Exists(_cachePath)) return TimeSpan.Zero;
        var age = DateTimeOffset.UtcNow - File.GetLastWriteTimeUtc(_cachePath);
        return age >= RefreshInterval ? TimeSpan.Zero : RefreshInterval - age;
    }

    async Task<bool> TryRefreshAsync()
    {
        try
        {
            var json = await _http.GetStringAsync(DetectableUrl);
            var names = ParseExeNames(json);
            if (names.Count == 0) return false;

            _exeNames = names;
            File.WriteAllText(_cachePath, json);
            Log.Info($"Detectable games list refreshed: {names.Count} executables");
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("Failed to refresh detectable games list", ex);
            return false;
        }
    }

    void LoadFromDisk()
    {
        if (!File.Exists(_cachePath)) return;
        try
        {
            _exeNames = ParseExeNames(File.ReadAllText(_cachePath));
        }
        catch (Exception ex)
        {
            Log.Error("Failed to load cached detectable games list", ex);
        }
    }

    internal static HashSet<string> ParseExeNames(string json)
    {
        var names = new HashSet<string>();
        using var doc = JsonDocument.Parse(json);
        foreach (var app in doc.RootElement.EnumerateArray())
        {
            if (!app.TryGetProperty("executables", out var executables)) continue;
            foreach (var exe in executables.EnumerateArray())
            {
                if (!exe.TryGetProperty("name", out var nameProp)) continue;
                var path = nameProp.GetString();
                if (string.IsNullOrWhiteSpace(path)) continue;

                var exeName = path.Replace('/', '\\').Split('\\')[^1];
                if (!string.IsNullOrWhiteSpace(exeName))
                    names.Add(exeName.ToLowerInvariant());
            }
        }
        return names;
    }

    public void Dispose() => Stop();
}
