// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Toolkit.Uwp.Notifications;
using Yurnik.Agent.Api;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Notifications;

sealed class EchoMonitor : IDisposable
{
    readonly IYurnikClient _client;
    readonly EchoStore _store;
    readonly System.Timers.Timer _timer;

    public EchoMonitor(IYurnikClient client, AgentConfig config, EchoStore store)
    {
        _client = client;
        _store = store;
        _timer = new System.Timers.Timer(config.SyncInterval.TotalMilliseconds);
        _timer.Elapsed += async (_, _) => await CheckForEchoesAsync();
    }

    public void Start()
    {
        _timer.Start();
        // Fire once immediately
        Task.Run(CheckForEchoesAsync);
    }

    public void Stop()
    {
        _timer.Stop();
    }

    async Task CheckForEchoesAsync()
    {
        try
        {
            Log.Info("Checking for echoes");
            var me = await _client.GetMeAsync();
            if (me.Status != ApiResult.Ok)
            {
                Log.Debug($"CheckForEchoesAsync: GetMeAsync failed with status {me.Status}");
                return;
            }

            // Check if user disabled echo notifications
            if (me.NotificationPreferences is not null && !me.NotificationPreferences.Echoes)
            {
                Log.Debug("CheckForEchoesAsync: User has disabled echo notifications in preferences");
                return;
            }

            var res = await _client.GetEchoesAsync();
            if (res.Status != ApiResult.Ok || res.Echoes is null)
            {
                Log.Debug($"CheckForEchoesAsync: GetEchoesAsync failed with status {res.Status} or null");
                return;
            }

            var unreadEchoes = res.Echoes.Where(e => !e.Read).ToList();
            Log.Debug($"CheckForEchoesAsync: API returned {unreadEchoes.Count} unread echoes");

            var newEchoes = unreadEchoes.Where(e => !_store.IsNotified(e.Id)).ToList();
            if (newEchoes.Count == 0)
            {
                Log.Debug("CheckForEchoesAsync: All unread echoes have already been notified. Nothing new to show.");
                return;
            }

            Log.Info($"Found {newEchoes.Count} new echoes to notify");

            // Grouping or showing generic notification? The user said:
            // "if in that hour you get 4 comments in a journey is 1 notifaction that say 4 people comment in your journey"
            // Actually the backend aggregates them for us! 
            // So one Echo in the API represents the aggregated event.
            // Example types: new_comment, new_comment_reply, new_follower, new_mention
            foreach (var echo in newEchoes)
            {
                var title = "";
                var text = "";

                if (echo.Type == "new_comment")
                {
                    title = "New comment";
                    text = echo.ActorCount > 1 
                        ? $"{echo.ActorCount} people commented on your journey \"{echo.SubjectTitle}\""
                        : $"Someone commented on your journey \"{echo.SubjectTitle}\"";
                }
                else if (echo.Type == "new_comment_reply")
                {
                    title = "New reply";
                    text = echo.ActorCount > 1
                        ? $"{echo.ActorCount} people replied to your comment in \"{echo.SubjectTitle}\""
                        : $"Someone replied to your comment in \"{echo.SubjectTitle}\"";
                }
                else if (echo.Type == "new_follower")
                {
                    title = "New follower";
                    text = echo.ActorCount > 1
                        ? $"{echo.ActorCount} people started following you"
                        : "Someone started following you";
                }
                else if (echo.Type == "new_mention")
                {
                    title = "New mention";
                    text = echo.ActorCount > 1
                        ? $"{echo.ActorCount} people mentioned you in \"{echo.SubjectTitle}\""
                        : $"Someone mentioned you in \"{echo.SubjectTitle}\"";
                }
                else if (echo.Type == "horizon_release")
                {
                    title = "Releasing soon";
                    text = $"\"{echo.SubjectTitle}\" is releasing soon!";
                }
                else
                {
                    title = "New activity";
                    text = "You have new activity on Yurnik";
                }

                new ToastContentBuilder()
                    .AddArgument("echoes")
                    .AddText(title)
                    .AddText(text)
                    .Show();
                    
                _store.MarkNotified(echo.Id);
            }
        }
        catch (Exception ex)
        {
            Log.Error("EchoMonitor check failed", ex);
        }
    }

    public void Dispose()
    {
        _timer.Dispose();
    }
}
