// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Queue;

record QueuedJourney(
    long Id,
    string ExeName,
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
    public void Enqueue(string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt)
    {
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO queue (exe_name, window_title, started_at, ended_at)
            VALUES ($exe, $title, $start, $end)
            """;
        cmd.Parameters.AddWithValue("$exe", exeName);
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
            SELECT id, exe_name, window_title, started_at, ended_at, attempts
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
                WindowTitle: reader.GetString(2),
                StartedAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(3)),
                EndedAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(4)),
                Attempts: reader.GetInt32(5)
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
