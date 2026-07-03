// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Xunit;

namespace Yurnik.Agent.Tests.Detection;

public class PeScannerTests
{
    [Theory]
    [InlineData("xinput1_4.dll")]
    [InlineData("XInput1_3.DLL")]
    [InlineData("dinput8.dll")]
    [InlineData("vulkan-1.dll")]
    [InlineData("UnityPlayer.dll")]
    [InlineData("fmod.dll")]
    [InlineData("steam_api64.dll")]
    public void HasGameImports_MatchesTargetDllsCaseInsensitively(string gameDll)
    {
        var imports = new[] { "kernel32.dll", "user32.dll", gameDll, "advapi32.dll" };
        Assert.True(PeScanner.HasGameImports(imports));
    }

    [Fact]
    public void HasGameImports_RejectsNonGameDlls()
    {
        var imports = new[] { "kernel32.dll", "d3d11.dll", "opengl32.dll", "shell32.dll", "gdi32.dll" };
        Assert.False(PeScanner.HasGameImports(imports));
    }

    [Fact]
    public void HasGameImports_EmptyOrNullRejects()
    {
        Assert.False(PeScanner.HasGameImports(Array.Empty<string>()));
    }
}
