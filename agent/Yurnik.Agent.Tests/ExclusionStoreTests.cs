// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;
using Xunit;

namespace Yurnik.Agent.Tests;

public class ExclusionStoreTests : IDisposable
{
    readonly Database _db;
    readonly ExclusionStore _store;
    readonly string _dbPath;

    public ExclusionStoreTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _store = new ExclusionStore(_db);
    }

    [Fact]
    public void Contains_UnknownExe_ReturnsFalse()
    {
        Assert.False(_store.Contains("discord.exe"));
    }

    [Fact]
    public void Contains_AfterReplaceAll_ReturnsTrueForSyncedExe()
    {
        _store.ReplaceAll(["discord.exe", "obs64.exe"]);

        Assert.True(_store.Contains("discord.exe"));
        Assert.True(_store.Contains("obs64.exe"));
        Assert.False(_store.Contains("game.exe"));
    }

    [Fact]
    public void Contains_IsCaseInsensitive()
    {
        _store.ReplaceAll(["Discord.exe"]);

        Assert.True(_store.Contains("discord.exe"));
        Assert.True(_store.Contains("DISCORD.EXE"));
    }

    [Fact]
    public void ReplaceAll_DropsExesNoLongerInTheList()
    {
        _store.ReplaceAll(["discord.exe"]);
        _store.ReplaceAll(["obs64.exe"]);

        Assert.False(_store.Contains("discord.exe"));
        Assert.True(_store.Contains("obs64.exe"));
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
