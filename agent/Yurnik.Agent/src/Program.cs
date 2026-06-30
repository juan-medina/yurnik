// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Globalization;
using Velopack;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Auth;
using Yurnik.Agent.Queue;
using Yurnik.Agent.Detection;
using Yurnik.Agent.Api;
using Yurnik.Agent.Notifications;

namespace Yurnik.Agent;

static class Program
{
    [STAThread]
    static void Main()
    {
        // Must run before anything else — handles Velopack install/uninstall hooks.
        VelopackApp.Build()
            .WithBeforeUninstallFastCallback(_ =>
            {
                var config = AgentConfig.Load();
                UninstallCleanup.Run(new CredentialStore(), config.DbPath);
            })
            .Run();

        // When the OS routes a yurnik:// URL to this exe it launches a new process
        // with the URL as the first argument. Forward it to the running instance
        // via the named pipe and exit — never start the full app in this case.
        var args = Environment.GetCommandLineArgs();
        if (args.Length > 1 && args[1].StartsWith("yurnik://", StringComparison.OrdinalIgnoreCase))
        {
            UrlSchemeListener.TryForward(args[1]);
            return;
        }

        ApplicationConfiguration.Initialize();
        Log.Reset();
        Log.Info("Yurnik agent starting");

        var config = AgentConfig.Load();

        if (!string.IsNullOrWhiteSpace(config.Language))
        {
            var culture = new CultureInfo(config.Language);
            CultureInfo.CurrentUICulture = culture;
            CultureInfo.DefaultThreadCurrentUICulture = culture;
        }

        var db = new Database(config.DbPath);
        db.Migrate();

        var exclusionStore = new ExclusionStore(db);
        var detectableGamesPath = Path.Combine(
            Path.GetDirectoryName(config.DbPath)!, "detectable_games.json");
        var detectableGames = new DetectableGamesCache(detectableGamesPath);
        detectableGames.Start();

        var credentialStore = new CredentialStore();
        var agentClient = new YurnikClient(config.ApiBaseUrl);
        var authManager = new AuthManager(config, credentialStore, agentClient, exclusionStore);
        authManager.Start();

        var sessionStore = new SessionStore(db);
        var eventQueue = new EventQueue(db);
        var sessionMonitor = new SessionMonitor(sessionStore, eventQueue, config.MinSessionDuration);
        var queueProcessor = new QueueProcessor(eventQueue, agentClient, authManager);
        var processWatcher = new ProcessWatcher(sessionStore, eventQueue, exclusionStore, detectableGames, config.MinSessionDuration);
        var updater = new Updater();
        var echoStore = new EchoStore(db);
        var echoMonitor = new EchoMonitor(agentClient, config, echoStore);

        using var trayApp = new TrayApp(config.WebBaseUrl, authManager, agentClient, processWatcher, sessionMonitor, queueProcessor, updater, detectableGames, echoMonitor);
        trayApp.Run();

        Log.Info("Yurnik agent stopped");
    }
}
