// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Api;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Detection;

/// <summary>
/// SQLite-backed cache of the user's exclusion list, synced from the API on
/// login and on every heartbeat. Lets ProcessWatcher skip known non-games
/// without a server round-trip on every detection.
/// </summary>
sealed class ExclusionStore(Database db)
{
    public void ReplaceAll(IEnumerable<ExclusionEntry> exclusions)
    {
        using var conn = db.OpenConnection();
        using var tx = conn.BeginTransaction();

        using var clearCmd = conn.CreateCommand();
        clearCmd.Transaction = tx;
        clearCmd.CommandText = "DELETE FROM exclusions";
        clearCmd.ExecuteNonQuery();

        using var insertCmd = conn.CreateCommand();
        insertCmd.Transaction = tx;
        insertCmd.CommandText = "INSERT OR IGNORE INTO exclusions (exe_name, path_hash) VALUES ($exe, $hash)";
        var paramExe = insertCmd.CreateParameter();
        paramExe.ParameterName = "$exe";
        insertCmd.Parameters.Add(paramExe);

        var paramHash = insertCmd.CreateParameter();
        paramHash.ParameterName = "$hash";
        insertCmd.Parameters.Add(paramHash);

        foreach (var entry in exclusions)
        {
            paramExe.Value = entry.ExeName.ToLowerInvariant();
            paramHash.Value = (object?)entry.PathHash ?? DBNull.Value;
            insertCmd.ExecuteNonQuery();
        }

        tx.Commit();
    }

    public bool Contains(string exeName, string? pathHash = null)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT EXISTS(
                SELECT 1 FROM exclusions
                WHERE exe_name = $exe
                  AND (path_hash IS NULL OR path_hash = '' OR path_hash = $hash)
            )
            """;
        cmd.Parameters.AddWithValue("$exe", exeName.ToLowerInvariant());
        cmd.Parameters.AddWithValue("$hash", (object?)pathHash ?? DBNull.Value);
        return (long)cmd.ExecuteScalar()! == 1;
    }
}

