// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Text.Json;

namespace Yurnik.Agent.Infrastructure;

sealed class AgentConfig
{
    public string ApiBaseUrl { get; init; } = "https://api.yurnik.social";
    public string WebBaseUrl { get; init; } = "https://yurnik.social";
    public string DbPath { get; init; } = DefaultDbPath();

    // BCP-47 language tag to override the Windows system language (e.g. "es", "en").
    // Null or absent means follow Windows system culture.
    public string? Language { get; init; }

    // How long before a queued event is considered stale and evicted.
    public TimeSpan EventTtl { get; init; } = TimeSpan.FromDays(3);

    // Gap between game_ended and game_started for the same exe below which
    // the two are merged into a single session.
    public TimeSpan MergeThreshold { get; init; } = TimeSpan.FromMinutes(10);

    // Minimum duration for a session to be enqueued. Sessions shorter than this
    // (e.g. game crashes or accidental launches) are discarded.
    public TimeSpan MinSessionDuration { get; init; } = TimeSpan.FromMinutes(5);

    // How often the agent checks /api/v1/agent/heartbeat to keep the session
    // token from expiring. The server renews tokens older than 24h, and the
    // session itself lasts 7 days, so a multi-day interval leaves ample margin.
    public TimeSpan AuthRefreshInterval { get; init; } = TimeSpan.FromDays(3);

    // How often the agent checks for new notifications (echoes).
    public TimeSpan EchoRefreshInterval { get; init; } = TimeSpan.FromHours(1);

    public static AgentConfig Load()
    {
        var dir = AppContext.BaseDirectory;
        var base_ = ReadFile(Path.Combine(dir, "appsettings.json"));
        var dev   = ReadFile(Path.Combine(dir, "appsettings.Development.json"));

        return new AgentConfig
        {
            ApiBaseUrl = dev?.ApiBaseUrl ?? base_?.ApiBaseUrl ?? "https://api.yurnik.social",
            WebBaseUrl = dev?.WebBaseUrl ?? base_?.WebBaseUrl ?? "https://yurnik.social",
            Language   = dev?.Language   ?? base_?.Language,
            AuthRefreshInterval = TimeSpan.FromSeconds(
                dev?.AuthRefreshIntervalSeconds ?? base_?.AuthRefreshIntervalSeconds ?? (3 * 24 * 60 * 60)),
            EchoRefreshInterval = TimeSpan.FromSeconds(
                dev?.EchoRefreshIntervalSeconds ?? base_?.EchoRefreshIntervalSeconds ?? 3600),
            MinSessionDuration = TimeSpan.FromSeconds(
                dev?.MinSessionDurationSeconds ?? base_?.MinSessionDurationSeconds ?? 300),
        };
    }

    static SettingsFile? ReadFile(string path)
    {
        if (!File.Exists(path)) return null;
        return JsonSerializer.Deserialize<SettingsFile>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    record SettingsFile(
        string? ApiBaseUrl,
        string? WebBaseUrl,
        string? Language,
        int? AuthRefreshIntervalSeconds,
        int? EchoRefreshIntervalSeconds,
        int? MinSessionDurationSeconds);

    static string DefaultDbPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "Yurnik");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "agent.db");
    }
}
