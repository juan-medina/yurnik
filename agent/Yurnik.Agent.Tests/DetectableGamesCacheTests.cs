// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Xunit;

namespace Yurnik.Agent.Tests;

public class DetectableGamesCacheTests
{
    [Fact]
    public void ParseExeNames_ExtractsLowercasedBasenamesAndGameNames()
    {
        const string json = """
            [
              { "name": "Starfield", "executables": [ { "name": "Starfield.exe", "os": "win32" } ] },
              { "name": "Counter-Strike 2", "executables": [ { "name": "game/bin/win64/cs2.exe", "os": "win32" } ] }
            ]
            """;

        var names = DetectableGamesCache.ParseExeNames(json);

        Assert.Contains("starfield.exe", (System.Collections.Generic.IDictionary<string, string>)names);
        Assert.Equal("Starfield", names["starfield.exe"]);

        Assert.Contains("cs2.exe", (System.Collections.Generic.IDictionary<string, string>)names);
        Assert.Equal("Counter-Strike 2", names["cs2.exe"]);
    }

    [Fact]
    public void ParseExeNames_SkipsEntriesWithoutExecutables()
    {
        const string json = """
            [
              { "name": "Some App" }
            ]
            """;

        var names = DetectableGamesCache.ParseExeNames(json);

        Assert.Empty(names);
    }

    [Fact]
    public void ParseExeNames_EmptyArray_ReturnsEmptySet()
    {
        var names = DetectableGamesCache.ParseExeNames("[]");

        Assert.Empty(names);
    }

    [Fact]
    public void TryGetGameName_DisambiguatesByPath()
    {
        const string json = """
            [
              { "name": "Game Alpha", "executables": [ { "name": "alpha/bin/launcher.exe", "os": "win32" } ] },
              { "name": "Game Beta", "executables": [ { "name": "beta/bin/launcher.exe", "os": "win32" } ] }
            ]
            """;

        var tempPath = Path.Combine(Path.GetTempPath(), $"detectable_test_{Guid.NewGuid():N}.json");
        try
        {
            File.WriteAllText(tempPath, json);
            var cache = new DetectableGamesCache(tempPath);

            Assert.True(cache.TryGetGameName("launcher.exe", @"C:\Games\alpha\bin\launcher.exe", out var gameAlpha));
            Assert.Equal("Game Alpha", gameAlpha);

            Assert.True(cache.TryGetGameName("launcher.exe", @"D:\Steam\steamapps\common\beta\bin\launcher.exe", out var gameBeta));
            Assert.Equal("Game Beta", gameBeta);

            Assert.True(cache.TryGetGameName("launcher.exe", out var fallback));
            Assert.NotNull(fallback);
        }
        finally
        {
            try { File.Delete(tempPath); } catch { }
        }
    }
}

