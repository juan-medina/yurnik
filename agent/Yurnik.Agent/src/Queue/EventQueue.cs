// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Queue;

record QueuedJourney(
    long Id,
    string ExeName,
    string? PathHash,
    string WindowTitle,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int Attempts
);

/// <summary>
/// SQLite-backed outbox between SessionMonitor and QueueProcessor.
/// SessionMonitor writes completed sessions; QueueProcessor reads and deletes on success.
/// </summary>
sealed class EventQueue(Database db)
{
    public void Enqueue(string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt) =>
        Enqueue(exeName, null, windowTitle, startedAt, endedAt);

    public void Enqueue(string exeName, string? pathHash, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT OR IGNORE INTO queue (exe_name, path_hash, window_title, started_at, ended_at)
            VALUES ($exe, $hash, $title, $start, $end)
            """;
        cmd.Parameters.AddWithValue("$exe", exeName);
        cmd.Parameters.AddWithValue("$hash", (object?)pathHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$title", windowTitle);
        cmd.Parameters.AddWithValue("$start", startedAt.ToUnixTimeSeconds());
        cmd.Parameters.AddWithValue("$end", endedAt.ToUnixTimeSeconds());
        cmd.ExecuteNonQuery();

        Log.Info($"Queued journey: {exeName} ({startedAt:HH:mm:ss}Z → {endedAt:HH:mm:ss}Z)");
    }

    public List<QueuedJourney> Peek(int limit = 20)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, exe_name, path_hash, window_title, started_at, ended_at, attempts
            FROM queue
            ORDER BY id ASC
            LIMIT $limit
            """;
        cmd.Parameters.AddWithValue("$limit", limit);

        var journeys = new List<QueuedJourney>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            journeys.Add(new QueuedJourney(
                Id: reader.GetInt64(0),
                ExeName: reader.GetString(1),
                PathHash: reader.IsDBNull(2) ? null : reader.GetString(2),
                WindowTitle: reader.GetString(3),
                StartedAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(4)),
                EndedAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(5)),
                Attempts: reader.GetInt32(6)
            ));
        }
        return journeys;
    }


    public void Delete(long id)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM queue WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    public void IncrementAttempts(long id)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE queue SET attempts = attempts + 1 WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }
}
