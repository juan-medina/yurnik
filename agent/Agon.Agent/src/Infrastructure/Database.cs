// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Infrastructure;

/// <summary>
/// Owns the SQLite connection and schema migrations.
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

        // WAL mode for better concurrent read/write.
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode=WAL;";
        cmd.ExecuteNonQuery();

        return conn;
    }

    public void Migrate()
    {
        Log.Info($"Running database migrations on {_path}");
        using var conn = OpenConnection();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS queue (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                type        TEXT    NOT NULL,       -- 'game_started' | 'game_ended'
                exe_name    TEXT    NOT NULL,        -- denormalised for merge lookups
                payload     TEXT    NOT NULL,        -- JSON blob
                created_at  INTEGER NOT NULL,        -- unix timestamp (seconds)
                attempts    INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS queue_exe_type
                ON queue(exe_name, type, created_at);
            """;
        cmd.ExecuteNonQuery();

        Log.Info("Database migrations complete");
    }
}
