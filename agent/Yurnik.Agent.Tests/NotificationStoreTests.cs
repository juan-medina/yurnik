// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Notifications;
using Yurnik.Agent.Infrastructure;
using Xunit;

namespace Yurnik.Agent.Tests;

public class NotificationStoreTests : IDisposable
{
    readonly Database _db;
    readonly NotificationStore _store;
    readonly string _dbPath;

    public NotificationStoreTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_test_{Guid.NewGuid():N}.db");
        _db = new Database(_dbPath);
        _db.Migrate();
        _store = new NotificationStore(_db);
    }

    [Fact]
    public void IsNotified_UnknownNotificationId_ReturnsFalse()
    {
        Assert.False(_store.IsNotified("notification_123"));
    }

    [Fact]
    public void IsNotified_AfterMarkNotified_ReturnsTrue()
    {
        _store.MarkNotified("notification_456");

        Assert.True(_store.IsNotified("notification_456"));
        Assert.False(_store.IsNotified("notification_789"));
    }

    [Fact]
    public void MarkNotified_CalledTwice_DoesNotThrow()
    {
        _store.MarkNotified("notification_duplicate");
        
        var exception = Record.Exception(() => _store.MarkNotified("notification_duplicate"));
        
        Assert.Null(exception);
        Assert.True(_store.IsNotified("notification_duplicate"));
    }

    public void Dispose()
    {
        try { File.Delete(_dbPath); } catch { }
    }
}
