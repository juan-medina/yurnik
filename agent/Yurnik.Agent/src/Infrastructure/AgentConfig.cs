// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Text.Json;

namespace Yurnik.Agent.Infrastructure;

sealed class AgentConfig
{
    public string ApiBaseUrl { get; init; } = "https://api.yurnik.social";
    public string WebBaseUrl { get; init; } = "https://yurnik.social";
    public string DbPath { get; init; } = DefaultDbPath();

    // How long before a queued event is considered stale and evicted.
    public TimeSpan EventTtl { get; init; } = TimeSpan.FromDays(3);

    // Gap between game_ended and game_started for the same exe below which
    // the two are merged into a single session.
    public TimeSpan MergeThreshold { get; init; } = TimeSpan.FromMinutes(10);

    public static AgentConfig Load()
    {
        var dir = AppContext.BaseDirectory;
        var base_ = ReadFile(Path.Combine(dir, "appsettings.json"));
        var dev   = ReadFile(Path.Combine(dir, "appsettings.Development.json"));

        return new AgentConfig
        {
            ApiBaseUrl = dev?.ApiBaseUrl ?? base_?.ApiBaseUrl ?? "https://api.yurnik.social",
            WebBaseUrl = dev?.WebBaseUrl ?? base_?.WebBaseUrl ?? "https://yurnik.social",
        };
    }

    static SettingsFile? ReadFile(string path)
    {
        if (!File.Exists(path)) return null;
        return JsonSerializer.Deserialize<SettingsFile>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    record SettingsFile(string? ApiBaseUrl, string? WebBaseUrl);

    static string DefaultDbPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "Yurnik");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "agent.db");
    }
}
