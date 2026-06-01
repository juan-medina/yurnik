// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Agon.Agent.Infrastructure;
using Agon.Agent.Auth;
using Agon.Agent.Queue;
using Agon.Agent.Detection;
using Agon.Agent.Api;

namespace Agon.Agent;

static class Program
{
    [STAThread]
    static void Main()
    {
        // When the OS routes an agon:// URL to this exe it launches a new process
        // with the URL as the first argument. Forward it to the running instance
        // via the named pipe and exit — never start the full app in this case.
        var args = Environment.GetCommandLineArgs();
        if (args.Length > 1 && args[1].StartsWith("agon://", StringComparison.OrdinalIgnoreCase))
        {
            UrlSchemeListener.TryForward(args[1]);
            return;
        }

        ApplicationConfiguration.Initialize();
        Log.Reset();
        Log.Info("Agon agent starting");

        var config = AgentConfig.Load();
        var db = new Database(config.DbPath);
        db.Migrate();

        var credentialStore = new CredentialStore();
        var agentClient = new AgonClient(config.ApiBaseUrl);
        var authManager = new AuthManager(config, credentialStore, agentClient);
        var eventQueue = new EventQueue(db);
        var queueProcessor = new QueueProcessor(eventQueue, agentClient, authManager);
        var processWatcher = new ProcessWatcher(eventQueue);

        using var trayApp = new TrayApp(config.WebBaseUrl, authManager, processWatcher, queueProcessor);
        trayApp.Run();

        Log.Info("Agon agent stopped");
    }
}
