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
}
