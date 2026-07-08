// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Data.Sqlite;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Notifications;

sealed class NotificationStore
{
    readonly Database _db;

    public NotificationStore(Database db)
    {
        _db = db;
    }

    public bool IsNotified(string notificationId)
    {
        using var conn = _db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM notified_notifications WHERE notification_id = @notification_id LIMIT 1;";
        cmd.Parameters.AddWithValue("@notification_id", notificationId);

        var result = cmd.ExecuteScalar();
        return result != null;
    }

    public void MarkNotified(string notificationId)
    {
        using var conn = _db.OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO notified_notifications (notification_id, notified_at)
            VALUES (@notification_id, @notified_at)
            ON CONFLICT(notification_id) DO NOTHING;
            """;
        cmd.Parameters.AddWithValue("@notification_id", notificationId);
        cmd.Parameters.AddWithValue("@notified_at", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        cmd.ExecuteNonQuery();
    }
}
