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
        else if (version < 5)
        {
            Log.Info($"Schema is version {version} — dropping queue table to apply new unique constraint");
            using var dropQueueCmd = conn.CreateCommand();
            dropQueueCmd.CommandText = "DROP TABLE IF EXISTS queue;";
            dropQueueCmd.ExecuteNonQuery();
        }
        if (version < 6)
        {
            Log.Info($"Schema is version {version} — dropping notified_notifications table for terminology update");
            using var dropNotificationsCmd = conn.CreateCommand();
            dropNotificationsCmd.CommandText = "DROP TABLE IF EXISTS notified_notifications;";
            dropNotificationsCmd.ExecuteNonQuery();
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
                attempts     INTEGER NOT NULL DEFAULT 0,
                UNIQUE(exe_name, started_at)
            );

            CREATE TABLE IF NOT EXISTS exclusions (
                exe_name TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS inclusions (
                exe_name TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS notified_notifications (
                notification_id TEXT    PRIMARY KEY,
                notified_at     INTEGER NOT NULL
            );
            """;
        schemaCmd.ExecuteNonQuery();

        using var pragmaCmd = conn.CreateCommand();
        pragmaCmd.CommandText = "PRAGMA user_version = 6;";
        pragmaCmd.ExecuteNonQuery();

        Log.Info("Database migrations complete");
    }

    static void DropAll(SqliteConnection conn)
    {
        var tables = new System.Collections.Generic.List<string>();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                tables.Add(reader.GetString(0));
            }
        }

        foreach (var table in tables)
        {
            using var dropCmd = conn.CreateCommand();
            dropCmd.CommandText = $"DROP TABLE IF EXISTS \"{table}\";";
            dropCmd.ExecuteNonQuery();
        }
    }
}
