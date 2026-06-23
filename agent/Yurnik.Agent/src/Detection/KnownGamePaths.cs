// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

namespace Yurnik.Agent.Detection;

/// <summary>
/// Path substrings under which third-party launchers install games. Used as
/// a last-resort signal for games not in Discord's detectable list (e.g. new
/// or niche titles). Deliberately excludes generic locations like a bare
/// "Program Files\&lt;name&gt;", which are indistinguishable from any other app.
/// </summary>
static class KnownGamePaths
{
    static readonly string[] Markers =
    [
        "\\steamapps\\common\\",
        "\\epic games\\",
        "\\ubisoft\\",
        "\\rockstar games\\",
        "\\battle.net\\",
        "\\ea games\\",
        "\\gog galaxy\\games\\",
    ];

    public static bool IsKnownGamePath(string exePath) =>
        Array.Exists(Markers, m => exePath.Contains(m, StringComparison.OrdinalIgnoreCase));
}
