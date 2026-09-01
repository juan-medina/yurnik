// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Detection;

record Session(
    int Pid,
    string ExeName,
    string? PathHash,
    string WindowTitle,
    DateTimeOffset StartedAt,
    DateTimeOffset LastRunningAt
);

/// <summary>
/// SQLite-backed store for currently-running game sessions.
/// ProcessWatcher inserts; SessionMonitor updates heartbeats and moves ended sessions to the queue.
/// </summary>
sealed class SessionStore(Database db)
{
    public void Insert(int pid, string exeName, string windowTitle) =>
        Insert(pid, exeName, null, windowTitle);

    public void Insert(int pid, string exeName, string? pathHash, string windowTitle)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT OR IGNORE INTO sessions (pid, exe_name, path_hash, window_title, started_at, last_running_at)
            VALUES ($pid, $exe, $hash, $title, $now, $now)
            """;
        cmd.Parameters.AddWithValue("$pid", pid);
        cmd.Parameters.AddWithValue("$exe", exeName);
        cmd.Parameters.AddWithValue("$hash", (object?)pathHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$title", windowTitle);
        cmd.Parameters.AddWithValue("$now", now);
        cmd.ExecuteNonQuery();
    }

    public void UpdateHeartbeat(int pid)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE sessions SET last_running_at = $now WHERE pid = $pid";
        cmd.Parameters.AddWithValue("$now", now);
        cmd.Parameters.AddWithValue("$pid", pid);
        cmd.ExecuteNonQuery();
    }

    public List<Session> GetAll()
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT pid, exe_name, path_hash, window_title, started_at, last_running_at FROM sessions";

        var sessions = new List<Session>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            sessions.Add(new Session(
                Pid: reader.GetInt32(0),
                ExeName: reader.GetString(1),
                PathHash: reader.IsDBNull(2) ? null : reader.GetString(2),
                WindowTitle: reader.GetString(3),
                StartedAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(4)),
                LastRunningAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(5))
            ));
        }
        return sessions;
    }


    public void Delete(int pid)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM sessions WHERE pid = $pid";
        cmd.Parameters.AddWithValue("$pid", pid);
        cmd.ExecuteNonQuery();
    }
}
