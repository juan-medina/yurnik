// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Xunit;

namespace Yurnik.Agent.Tests;

public class KnownGamePathsTests
{
    [Theory]
    [InlineData(@"C:\Program Files (x86)\Steam\steamapps\common\Starfield\Starfield.exe")]
    [InlineData(@"C:\Program Files\Epic Games\Fortnite\FortniteClient.exe")]
    [InlineData(@"D:\Games\Ubisoft\Ubisoft Game Launcher\AC Mirage\ACMirage.exe")]
    [InlineData(@"C:\Program Files\Rockstar Games\Grand Theft Auto V\GTA5.exe")]
    public void IsKnownGamePath_MatchesKnownLauncherDirectories(string exePath)
    {
        Assert.True(KnownGamePaths.IsKnownGamePath(exePath));
    }

    [Theory]
    [InlineData(@"C:\Program Files\SomeApp\app.exe")]
    [InlineData(@"C:\Windows\System32\notepad.exe")]
    public void IsKnownGamePath_DoesNotMatchGenericInstallLocations(string exePath)
    {
        Assert.False(KnownGamePaths.IsKnownGamePath(exePath));
    }
}
