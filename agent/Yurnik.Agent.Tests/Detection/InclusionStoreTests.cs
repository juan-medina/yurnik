// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;
using Xunit;

namespace Yurnik.Agent.Tests;

public class InclusionStoreTests : IDisposable
{
    readonly Database _db;
    readonly InclusionStore _store;
    readonly string _dbPath;

    public InclusionStoreTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _store = new InclusionStore(_db);
    }

    [Fact]
    public void Contains_UnknownExe_ReturnsFalse()
    {
        Assert.False(_store.Contains("discord.exe"));
    }

    [Fact]
    public void Contains_AfterReplaceAll_ReturnsTrueForSyncedExe()
    {
        _store.ReplaceAll(["mygame.exe", "awesome.exe"]);

        Assert.True(_store.Contains("mygame.exe"));
        Assert.True(_store.Contains("awesome.exe"));
        Assert.False(_store.Contains("game.exe"));
    }

    [Fact]
    public void Contains_IsCaseInsensitive()
    {
        _store.ReplaceAll(["MyGame.exe"]);

        Assert.True(_store.Contains("mygame.exe"));
        Assert.True(_store.Contains("MYGAME.EXE"));
    }

    [Fact]
    public void ReplaceAll_DropsExesNoLongerInTheList()
    {
        _store.ReplaceAll(["mygame.exe"]);
        _store.ReplaceAll(["awesome.exe"]);

        Assert.False(_store.Contains("mygame.exe"));
        Assert.True(_store.Contains("awesome.exe"));
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
