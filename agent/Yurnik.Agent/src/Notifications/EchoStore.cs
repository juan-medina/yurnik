// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Notifications;

sealed class EchoStore
{
    readonly Database _db;

    public EchoStore(Database db)
    {
        _db = db;
    }

    public bool IsNotified(string echoId)
    {
        using var conn = _db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM notified_echoes WHERE echo_id = @echo_id LIMIT 1;";
        cmd.Parameters.AddWithValue("@echo_id", echoId);

        var result = cmd.ExecuteScalar();
        return result != null;
    }

    public void MarkNotified(string echoId)
    {
        using var conn = _db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO notified_echoes (echo_id, notified_at)
            VALUES (@echo_id, @notified_at)
            ON CONFLICT(echo_id) DO NOTHING;
            """;
        cmd.Parameters.AddWithValue("@echo_id", echoId);
        cmd.Parameters.AddWithValue("@notified_at", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        cmd.ExecuteNonQuery();
    }
}
