// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Infrastructure;
using Xunit;

namespace Yurnik.Agent.Tests;

public class UninstallCleanupTests
{
    [Fact]
    public void DeleteDatabaseFiles_RemovesDatabaseAndWalSidecars()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_uninstall_{Guid.NewGuid():N}.db");
        File.WriteAllText(dbPath, "db");
        File.WriteAllText(dbPath + "-wal", "wal");
        File.WriteAllText(dbPath + "-shm", "shm");

        UninstallCleanup.DeleteDatabaseFiles(dbPath);

        Assert.False(File.Exists(dbPath));
        Assert.False(File.Exists(dbPath + "-wal"));
        Assert.False(File.Exists(dbPath + "-shm"));
    }

    [Fact]
    public void DeleteDatabaseFiles_MissingFiles_DoesNotThrow()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"yurnik_uninstall_{Guid.NewGuid():N}.db");

        UninstallCleanup.DeleteDatabaseFiles(dbPath);
    }
}
