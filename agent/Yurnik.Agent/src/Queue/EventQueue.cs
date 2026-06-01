// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Text.Json;
using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Queue;

enum QueueEventType { GameStarted, GameEnded }

record QueueEvent(
    long Id,
    QueueEventType Type,
    string ExeName,
    string WindowTitle,
    DateTimeOffset OccurredAt,
    int Attempts
);

/// <summary>
/// SQLite-backed event queue between ProcessWatcher and QueueProcessor.
/// ProcessWatcher writes; QueueProcessor reads and deletes on success.
/// </summary>
sealed class EventQueue(Database db)
{
    readonly TimeSpan _ttl = TimeSpan.FromDays(3);

    public void Enqueue(QueueEventType type, string exeName, string windowTitle)
    {
        var payload = JsonSerializer.Serialize(new { exe_name = exeName, window_title = windowTitle });
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO queue (type, exe_name, payload, created_at)
            VALUES ($type, $exe, $payload, $now)
            """;
        cmd.Parameters.AddWithValue("$type", type.ToString());
        cmd.Parameters.AddWithValue("$exe", exeName);
        cmd.Parameters.AddWithValue("$payload", payload);
        cmd.Parameters.AddWithValue("$now", now);
        cmd.ExecuteNonQuery();

        Log.Info($"Queued {type} for {exeName}");
    }

    /// <summary>
    /// Returns pending events ordered by id ascending, excluding stale ones.
    /// </summary>
    public List<QueueEvent> Peek(int limit = 20)
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(_ttl).ToUnixTimeSeconds();

        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, type, exe_name, payload, created_at, attempts
            FROM queue
            WHERE created_at >= $cutoff
            ORDER BY id ASC
            LIMIT $limit
            """;
        cmd.Parameters.AddWithValue("$cutoff", cutoff);
        cmd.Parameters.AddWithValue("$limit", limit);

        var events = new List<QueueEvent>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var typeStr = reader.GetString(1);
            var type = Enum.Parse<QueueEventType>(typeStr);
            var payload = JsonDocument.Parse(reader.GetString(3)).RootElement;
            var windowTitle = payload.TryGetProperty("window_title", out var wt) ? wt.GetString() ?? "" : "";

            events.Add(new QueueEvent(
                Id: reader.GetInt64(0),
                Type: type,
                ExeName: reader.GetString(2),
                WindowTitle: windowTitle,
                OccurredAt: DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64(4)),
                Attempts: reader.GetInt32(5)
            ));
        }
        return events;
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

    /// <summary>
    /// Deletes events older than the TTL. Called at the start of each drain cycle.
    /// </summary>
    public void Evict()
    {
        var cutoff = DateTimeOffset.UtcNow.Subtract(_ttl).ToUnixTimeSeconds();
        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM queue WHERE created_at < $cutoff";
        cmd.Parameters.AddWithValue("$cutoff", cutoff);
        var deleted = cmd.ExecuteNonQuery();
        if (deleted > 0)
            Log.Info($"Evicted {deleted} stale queue event(s)");
    }

    /// <summary>
    /// Looks for a recent game_ended event for the same exe within the merge
    /// threshold. Returns its id if found, null otherwise.
    /// </summary>
    public long? FindMergeCandidate(string exeName, TimeSpan threshold)
    {
        var since = DateTimeOffset.UtcNow.Subtract(threshold).ToUnixTimeSeconds();

        using var conn = db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id FROM queue
            WHERE type = 'GameEnded'
              AND exe_name = $exe
              AND created_at >= $since
            ORDER BY created_at DESC
            LIMIT 1
            """;
        cmd.Parameters.AddWithValue("$exe", exeName);
        cmd.Parameters.AddWithValue("$since", since);

        var result = cmd.ExecuteScalar();
        return result is long id ? id : null;
    }
}
