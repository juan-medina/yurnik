// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Agon.Agent.Auth;
using Agon.Agent.Detection;
using Agon.Agent.Infrastructure;
using Agon.Agent.Queue;

namespace Agon.Agent;

/// <summary>
/// Owns the system tray icon and the application message loop.
/// Wires all components together and manages their lifecycle.
/// </summary>
sealed class TrayApp : IDisposable
{
    readonly AuthManager _auth;
    readonly ProcessWatcher _watcher;
    readonly QueueProcessor _processor;
    readonly string _webBaseUrl;
    readonly NotifyIcon _tray;
    readonly ApplicationContext _context;

    public TrayApp(string webBaseUrl, AuthManager auth, ProcessWatcher watcher, QueueProcessor processor)
    {
        _webBaseUrl = webBaseUrl;
        _auth = auth;
        _watcher = watcher;
        _processor = processor;

        _tray = new NotifyIcon
        {
            Icon = SystemIcons.Application, // TODO: replace with Agon icon
            Visible = true,
            Text = "Agōn — starting…",
            ContextMenuStrip = BuildContextMenu(),
        };

        _context = new ApplicationContext();
        _auth.AuthStateChanged += OnAuthStateChanged;
    }

    public void Run()
    {
        // Register agon:// before anything else — the auth flow needs it.
        UrlSchemeRegistrar.Register();

        // Bootstrap auth, then start watchers if already authenticated.
        Task.Run(async () =>
        {
            try
            {
                var authenticated = await _auth.InitialiseAsync();
                if (authenticated)
                {
                    StartWorkers();
                }
                else
                {
                    UpdateTray("Agōn — login required", "Click to sign in");
                    _auth.StartLoginFlow();
                }
            }
            catch (Exception ex)
            {
                Log.Error("Startup task failed", ex);
            }
        });

        Application.Run(_context);
    }

    void OnAuthStateChanged(bool authenticated)
    {
        if (authenticated)
        {
            StartWorkers();
            UpdateTray("Agōn", null);
        }
        else
        {
            StopWorkers();
            UpdateTray("Agōn — login required", "Click to sign in");
            _auth.StartLoginFlow();
        }
    }

    void StartWorkers()
    {
        _processor.Start();
        _watcher.Start();
        Log.Info("Workers started");
    }

    void StopWorkers()
    {
        _watcher.Stop();
        _processor.Stop();
        Log.Info("Workers stopped");
    }

    void UpdateTray(string tooltip, string? balloon)
    {
        _tray.Text = tooltip.Length > 63 ? tooltip[..63] : tooltip;
        if (balloon is not null)
            _tray.ShowBalloonTip(3000, "Agōn", balloon, ToolTipIcon.Info);
    }

    ContextMenuStrip BuildContextMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Agōn", null, (_, _) =>
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(_webBaseUrl)
            {
                UseShellExecute = true
            });
        });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit", null, (_, _) =>
        {
            Log.Info("Exit requested from tray menu");
            StopWorkers();
            _tray.Visible = false;
            _context.ExitThread();
        });
        return menu;
    }

    public void Dispose()
    {
        _auth.AuthStateChanged -= OnAuthStateChanged;
        _tray.Dispose();
        _auth.Dispose();
        _watcher.Dispose();
        _processor.Dispose();
    }
}
