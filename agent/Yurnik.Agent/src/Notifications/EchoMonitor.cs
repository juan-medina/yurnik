// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Toolkit.Uwp.Notifications;
using Yurnik.Agent.Api;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Notifications;

sealed class EchoMonitor : IDisposable
{
    readonly IYurnikClient _client;
    readonly System.Timers.Timer _timer;
    readonly HashSet<string> _seenEchoes = new();
    bool _firstRun = true;

    public EchoMonitor(IYurnikClient client)
    {
        _client = client;
        _timer = new System.Timers.Timer(TimeSpan.FromHours(1).TotalMilliseconds);
        _timer.Elapsed += async (_, _) => await CheckForEchoesAsync();
    }

    public void Start()
    {
        _firstRun = true;
        _seenEchoes.Clear();
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
            var me = await _client.GetMeAsync();
            if (me.Status != ApiResult.Ok) return;

            // Check if user disabled echo notifications
            if (me.NotificationPreferences is not null && !me.NotificationPreferences.Echoes)
                return;

            var res = await _client.GetEchoesAsync();
            if (res.Status != ApiResult.Ok || res.Echoes is null) return;

            var unreadEchoes = res.Echoes.Where(e => !e.Read).ToList();

            if (_firstRun)
            {
                // Just populate seen echoes on first run so we don't alert for old ones
                foreach (var e in unreadEchoes) _seenEchoes.Add(e.Id);
                _firstRun = false;
                return;
            }

            var newEchoes = unreadEchoes.Where(e => !_seenEchoes.Contains(e.Id)).ToList();
            if (newEchoes.Count == 0) return;

            foreach (var e in newEchoes) _seenEchoes.Add(e.Id);

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
