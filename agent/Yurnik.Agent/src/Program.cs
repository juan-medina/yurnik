// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Auth;
using Yurnik.Agent.Queue;
using Yurnik.Agent.Detection;
using Yurnik.Agent.Api;

namespace Yurnik.Agent;

static class Program
{
    [STAThread]
    static void Main()
    {
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
        var db = new Database(config.DbPath);
        db.Migrate();

        var credentialStore = new CredentialStore();
        var agentClient = new YurnikClient(config.ApiBaseUrl);
        var authManager = new AuthManager(config, credentialStore, agentClient);
        var eventQueue = new EventQueue(db);
        var queueProcessor = new QueueProcessor(eventQueue, agentClient, authManager);
        var processWatcher = new ProcessWatcher(eventQueue);

        using var trayApp = new TrayApp(config.WebBaseUrl, authManager, processWatcher, queueProcessor);
        trayApp.Run();

        Log.Info("Yurnik agent stopped");
    }
}
