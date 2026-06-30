// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Notifications;
using Yurnik.Agent.Infrastructure;
using Xunit;

namespace Yurnik.Agent.Tests;

public class EchoStoreTests : IDisposable
{
    readonly Database _db;
    readonly EchoStore _store;
    readonly string _dbPath;

    public EchoStoreTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _store = new EchoStore(_db);
    }

    [Fact]
    public void IsNotified_UnknownEchoId_ReturnsFalse()
    {
        Assert.False(_store.IsNotified("echo_123"));
    }

    [Fact]
    public void IsNotified_AfterMarkNotified_ReturnsTrue()
    {
        _store.MarkNotified("echo_456");

        Assert.True(_store.IsNotified("echo_456"));
        Assert.False(_store.IsNotified("echo_789"));
    }

    [Fact]
    public void MarkNotified_CalledTwice_DoesNotThrow()
    {
        _store.MarkNotified("echo_duplicate");
        
        var exception = Record.Exception(() => _store.MarkNotified("echo_duplicate"));
        
        Assert.Null(exception);
        Assert.True(_store.IsNotified("echo_duplicate"));
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
