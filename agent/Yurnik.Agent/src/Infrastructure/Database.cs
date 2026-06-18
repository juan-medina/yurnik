// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;

namespace Yurnik.Agent.Infrastructure;

/// <summary>
/// Owns the SQLite connection and schema initialisation.
/// All other components receive this and call OpenConnection() to get a connection.
/// </summary>
sealed class Database
{
    readonly string _path;

    public Database(string path)
    {
        _path = path;
    }

    public SqliteConnection OpenConnection()
    {
        var conn = new SqliteConnection($"Data Source={_path}");
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode=WAL;";
        cmd.ExecuteNonQuery();

        return conn;
    }

    public void Migrate()
    {
        Log.Info($"Running database migrations on {_path}");
        using var conn = OpenConnection();

        using var versionCmd = conn.CreateCommand();
        versionCmd.CommandText = "PRAGMA user_version;";
        var version = (long)(versionCmd.ExecuteScalar() ?? 0L);

        // Versions 0 and 1 had an incompatible schema — drop everything and start clean.
        if (version < 2)
        {
            Log.Info($"Schema is version {version} — recreating tables");
            DropAll(conn);
        }

        using var schemaCmd = conn.CreateCommand();
        schemaCmd.CommandText = """
            CREATE TABLE IF NOT EXISTS sessions (
                pid             INTEGER PRIMARY KEY,
                exe_name        TEXT    NOT NULL,
                window_title    TEXT    NOT NULL,
                started_at      INTEGER NOT NULL,
                last_running_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS queue (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                exe_name     TEXT    NOT NULL,
                window_title TEXT    NOT NULL,
                started_at   INTEGER NOT NULL,
                ended_at     INTEGER NOT NULL,
                attempts     INTEGER NOT NULL DEFAULT 0
            );
            """;
        schemaCmd.ExecuteNonQuery();

        using var pragmaCmd = conn.CreateCommand();
        pragmaCmd.CommandText = "PRAGMA user_version = 2;";
        pragmaCmd.ExecuteNonQuery();

        Log.Info("Database migrations complete");
    }

    static void DropAll(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            DROP TABLE IF EXISTS sessions;
            DROP TABLE IF EXISTS queue;
            DROP TABLE IF EXISTS schema_version;
            """;
        cmd.ExecuteNonQuery();
    }
}
