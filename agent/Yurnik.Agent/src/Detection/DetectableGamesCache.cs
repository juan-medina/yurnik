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

    Dictionary<string, List<(string Pattern, string GameName)>> _entriesByExe = [];
    Task? _refreshTask;

    public DetectableGamesCache(string cachePath)
    {
        _cachePath = cachePath;
        LoadFromDisk();
    }

    public bool TryGetGameName(string exeName, string? fullPath, out string? gameName)
    {
        var lowerExe = exeName.ToLowerInvariant();
        var lowerPath = fullPath?.ToLowerInvariant().Replace('/', '\\');

        if (_entriesByExe.TryGetValue(lowerExe, out var entries))
        {
            if (lowerPath is not null)
            {
                foreach (var entry in entries)
                {
                    if (entry.Pattern.Contains('\\') && lowerPath.EndsWith(entry.Pattern))
                    {
                        gameName = entry.GameName;
                        return true;
                    }
                }
            }
            foreach (var entry in entries)
            {
                if (!entry.Pattern.Contains('\\'))
                {
                    gameName = entry.GameName;
                    return true;
                }
            }
            if (entries.Count > 0)
            {
                gameName = entries[0].GameName;
                return true;
            }
        }

        gameName = null;
        return false;
    }

    public bool TryGetGameName(string exeName, out string? gameName) =>
        TryGetGameName(exeName, null, out gameName);

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
            var entries = ParseEntries(json);
            if (entries.Count == 0) return false;

            _entriesByExe = entries;
            File.WriteAllText(_cachePath, json);
            Log.Info($"Detectable games list refreshed: {entries.Count} executables");
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
            _entriesByExe = ParseEntries(File.ReadAllText(_cachePath));
        }
        catch (Exception ex)
        {
            Log.Error("Failed to load cached detectable games list", ex);
        }
    }

    internal static Dictionary<string, List<(string Pattern, string GameName)>> ParseEntries(string json)
    {
        var result = new Dictionary<string, List<(string Pattern, string GameName)>>();
        using var doc = JsonDocument.Parse(json);
        foreach (var app in doc.RootElement.EnumerateArray())
        {
            if (!app.TryGetProperty("executables", out var executables)) continue;
            
            app.TryGetProperty("name", out var gameNameProp);
            var gameName = gameNameProp.ValueKind == JsonValueKind.String ? gameNameProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(gameName)) continue;

            foreach (var exe in executables.EnumerateArray())
            {
                if (!exe.TryGetProperty("name", out var nameProp)) continue;
                var rawPath = nameProp.GetString();
                if (string.IsNullOrWhiteSpace(rawPath)) continue;

                var pattern = rawPath.Replace('/', '\\').ToLowerInvariant();
                var exeName = pattern.Split('\\')[^1];
                if (!string.IsNullOrWhiteSpace(exeName))
                {
                    if (!result.TryGetValue(exeName, out var list))
                    {
                        list = [];
                        result[exeName] = list;
                    }
                    list.Add((pattern, gameName));
                }
            }
        }
        return result;
    }

    // For backwards-compatibility with existing tests
    internal static Dictionary<string, string> ParseExeNames(string json)
    {
        var entries = ParseEntries(json);
        var map = new Dictionary<string, string>();
        foreach (var (k, list) in entries)
        {
            if (list.Count > 0)
                map[k] = list[0].GameName;
        }
        return map;
    }

    public void Dispose() => Stop();
}

