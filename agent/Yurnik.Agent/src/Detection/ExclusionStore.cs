// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Detection;

/// <summary>
/// SQLite-backed cache of the user's exclusion list, synced from the API on
/// login and on every heartbeat. Lets ProcessWatcher skip known non-games
/// without a server round-trip on every detection.
/// </summary>
sealed class ExclusionStore(Database db)
{
    public void ReplaceAll(IEnumerable<string> exeNames)
    {
        using var conn = db.OpenConnection();
        using var tx = conn.BeginTransaction();

        using var clearCmd = conn.CreateCommand();
        clearCmd.Transaction = tx;
        clearCmd.CommandText = "DELETE FROM exclusions";
        clearCmd.ExecuteNonQuery();

        using var insertCmd = conn.CreateCommand();
        insertCmd.Transaction = tx;
        insertCmd.CommandText = "INSERT OR IGNORE INTO exclusions (exe_name) VALUES ($exe)";
        var param = insertCmd.CreateParameter();
        param.ParameterName = "$exe";
        insertCmd.Parameters.Add(param);

        foreach (var exeName in exeNames)
        {
            param.Value = exeName.ToLowerInvariant();
            insertCmd.ExecuteNonQuery();
        }

        tx.Commit();
    }

    public bool Contains(string exeName)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT EXISTS(SELECT 1 FROM exclusions WHERE exe_name = $exe)";
        cmd.Parameters.AddWithValue("$exe", exeName.ToLowerInvariant());
        return (long)cmd.ExecuteScalar()! == 1;
    }
}
