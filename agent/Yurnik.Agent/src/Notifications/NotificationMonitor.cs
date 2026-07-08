// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Toolkit.Uwp.Notifications;
using Yurnik.Agent.Api;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Notifications;

sealed class NotificationMonitor : IDisposable
{
    readonly IYurnikClient _client;
    readonly NotificationStore _store;
    readonly System.Timers.Timer _timer;

    public NotificationMonitor(IYurnikClient client, AgentConfig config, NotificationStore store)
    {
        _client = client;
        _store = store;
        _timer = new System.Timers.Timer(config.NotificationRefreshInterval.TotalMilliseconds);
        _timer.Elapsed += async (_, _) => await CheckForNotificationsAsync();
    }

    public void Start()
    {
        _timer.Start();
        // Fire once immediately
        Task.Run(CheckForNotificationsAsync);
    }

    public void Stop()
    {
        _timer.Stop();
    }

    async Task CheckForNotificationsAsync()
    {
        try
        {
            Log.Info("Checking for notifications");
            var me = await _client.GetMeAsync();
            if (me.Status != ApiResult.Ok)
            {
                Log.Debug($"CheckForNotificationsAsync: GetMeAsync failed with status {me.Status}");
                return;
            }

            // Check if user disabled notifications in preferences
            if (me.NotificationPreferences is not null && !me.NotificationPreferences.Notifications)
            {
                Log.Debug("CheckForNotificationsAsync: User has disabled notifications in preferences");
                return;
            }

            var res = await _client.GetNotificationsAsync();
            if (res.Status != ApiResult.Ok || res.Notifications is null)
            {
                Log.Debug($"CheckForNotificationsAsync: GetNotificationsAsync failed with status {res.Status} or null");
                return;
            }

            var unreadNotifications = res.Notifications.Where(e => !e.Read).ToList();
            Log.Debug($"CheckForNotificationsAsync: API returned {unreadNotifications.Count} unread notifications");

            var newNotifications = unreadNotifications.Where(e => !_store.IsNotified(e.Id)).ToList();
            if (newNotifications.Count == 0)
            {
                Log.Debug("CheckForNotificationsAsync: All unread notifications have already been notified. Nothing new to show.");
                return;
            }

            Log.Info($"Found {newNotifications.Count} new notifications to notify");

            foreach (var notification in newNotifications)
            {
                var title = "";
                var text = "";

                if (notification.Type == "new_comment")
                {
                    title = "New comment";
                    text = notification.ActorCount > 1 
                        ? $"{notification.ActorCount} people commented on your journey \"{notification.SubjectTitle}\""
                        : $"Someone commented on your journey \"{notification.SubjectTitle}\"";
                }
                else if (notification.Type == "new_comment_reply")
                {
                    title = "New reply";
                    text = notification.ActorCount > 1
                        ? $"{notification.ActorCount} people replied to your comment in \"{notification.SubjectTitle}\""
                        : $"Someone replied to your comment in \"{notification.SubjectTitle}\"";
                }
                else if (notification.Type == "new_follower")
                {
                    title = "New follower";
                    text = notification.ActorCount > 1
                        ? $"{notification.ActorCount} people started following you"
                        : "Someone started following you";
                }
                else if (notification.Type == "new_mention")
                {
                    title = "New mention";
                    text = notification.ActorCount > 1
                        ? $"{notification.ActorCount} people mentioned you in \"{notification.SubjectTitle}\""
                        : $"Someone mentioned you in \"{notification.SubjectTitle}\"";
                }
                else if (notification.Type == "backlog_release")
                {
                    title = "Releasing soon";
                    text = $"\"{notification.SubjectTitle}\" is releasing soon!";
                }
                else
                {
                    title = "New activity";
                    text = "You have new activity on Yurnik";
                }

                new ToastContentBuilder()
                    .AddArgument("notifications")
                    .AddText(title)
                    .AddText(text)
                    .Show();
                    
                _store.MarkNotified(notification.Id);
            }
        }
        catch (Exception ex)
        {
            Log.Error("NotificationMonitor check failed", ex);
        }
    }

    public void Dispose()
    {
        _timer.Dispose();
    }
}
