// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Velopack;
using Yurnik.Agent.Api;
using Yurnik.Agent.Auth;
using Yurnik.Agent.Detection;
using Yurnik.Agent.Infrastructure;
using Yurnik.Agent.Queue;

namespace Yurnik.Agent;

/// <summary>
/// Owns the system tray icon and the application message loop.
/// Wires all components together and manages their lifecycle.
/// </summary>
sealed class TrayApp : IDisposable
{
    readonly AuthManager _auth;
    readonly IYurnikClient _client;
    readonly ProcessWatcher _watcher;
    readonly SessionMonitor _sessionMonitor;
    readonly QueueProcessor _processor;
    readonly Updater _updater;
    readonly DetectableGamesCache _detectableGames;
    readonly string _webBaseUrl;
    readonly NotifyIcon _tray;
    readonly Icon _normalIcon;
    readonly ApplicationContext _context;

    bool _authenticated;
    UpdateInfo? _pendingUpdate;

    ToolStripMenuItem? _signInItem;
    ToolStripMenuItem? _signOutItem;

    public TrayApp(string webBaseUrl, AuthManager auth, IYurnikClient client, ProcessWatcher watcher, SessionMonitor sessionMonitor, QueueProcessor processor, Updater updater, DetectableGamesCache detectableGames)
    {
        _webBaseUrl = webBaseUrl;
        _auth = auth;
        _client = client;
        _watcher = watcher;
        _sessionMonitor = sessionMonitor;
        _processor = processor;
        _updater = updater;
        _detectableGames = detectableGames;

        var iconStream = typeof(TrayApp).Assembly.GetManifestResourceStream("Yurnik.Agent.Resources.tray.ico");
        _normalIcon = iconStream is not null ? new Icon(iconStream) : SystemIcons.Application;

        _tray = new NotifyIcon
        {
            Icon = _normalIcon,
            Visible = true,
            Text = Strings.TrayStarting,
            ContextMenuStrip = BuildContextMenu(),
        };
        _tray.BalloonTipClicked += OnBalloonClicked;
        _tray.MouseClick += OnTrayIconClicked;

        _context = new ApplicationContext();
        _auth.AuthStateChanged += OnAuthStateChanged;
    }

    public void Run()
    {
        StartupRegistrar.Register();
        UrlSchemeRegistrar.Register();

        Task.Run(async () =>
        {
            try
            {
                var authenticated = await _auth.InitialiseAsync();
                if (!authenticated)
                    ShowSignInRequired();

                await CheckForUpdatesAsync();
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
        // AuthStateChanged fires from background threads — marshal to the UI thread.
        if (_tray.ContextMenuStrip?.InvokeRequired == true)
        {
            _tray.ContextMenuStrip.Invoke(() => OnAuthStateChanged(authenticated));
            return;
        }

        _authenticated = authenticated;
        UpdateAuthMenuItems();
        if (authenticated)
        {
            StartWorkers();
            _tray.Icon = _normalIcon;
            UpdateTray(Strings.TrayReady, null);
        }
        else
        {
            StopWorkers();
            ShowSignInRequired();
        }
    }

    void UpdateAuthMenuItems()
    {
        if (_signInItem is null || _signOutItem is null) return;
        _signInItem.Visible = !_authenticated;
        _signOutItem.Visible = _authenticated;
    }

    void ShowSignInRequired()
    {
        _tray.Icon = SystemIcons.Warning;
        UpdateTray(Strings.TraySignInRequired, Strings.BalloonSignIn);
    }

    void OnBalloonClicked(object? sender, EventArgs e)
    {
        if (!_authenticated)
        {
            _auth.StartLoginFlow();
            return;
        }

        if (_pendingUpdate is not null)
        {
            var update = _pendingUpdate;
            Task.Run(async () =>
            {
                try { await _updater.DownloadAndRestartAsync(update); }
                catch (Exception ex) { Log.Error("Update failed", ex); }
            });
        }
    }

    void OnTrayIconClicked(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;

        if (!_authenticated)
        {
            _auth.StartLoginFlow();
            return;
        }

        if (_pendingUpdate is not null)
        {
            var update = _pendingUpdate;
            Task.Run(async () =>
            {
                try { await _updater.DownloadAndRestartAsync(update); }
                catch (Exception ex) { Log.Error("Update failed", ex); }
            });
            return;
        }

        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
            $"{_webBaseUrl}/journeys") { UseShellExecute = true });
    }

    async Task CheckForUpdatesAsync()
    {
        var update = await _updater.CheckAsync();
        if (update is null) return;

        _pendingUpdate = update;
        _tray.Icon = SystemIcons.Information;
        UpdateTray(Strings.TrayUpdateAvailable, Strings.BalloonUpdateAvailable(update.TargetFullRelease.Version.ToString()));
    }

    void StartWorkers()
    {
        _sessionMonitor.Start();
        _processor.Start();
        _watcher.Start();
        Log.Info("Workers started");
    }

    void StopWorkers()
    {
        _watcher.Stop();
        _sessionMonitor.Stop();
        _processor.Stop();
        Log.Info("Workers stopped");
    }

    void UpdateTray(string tooltip, string? balloon)
    {
        _tray.Text = tooltip.Length > 63 ? tooltip[..63] : tooltip;
        if (balloon is not null)
            _tray.ShowBalloonTip(3000, "Yurnik", balloon, ToolTipIcon.Info);
    }

    static string AppVersion()
    {
        var v = typeof(TrayApp).Assembly
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .OfType<System.Reflection.AssemblyInformationalVersionAttribute>()
            .FirstOrDefault()?.InformationalVersion ?? "unknown";
        var plus = v.IndexOf('+');
        return plus >= 0 ? v[..plus] : v;
    }

    ContextMenuStrip BuildContextMenu()
    {
        var menu = new ContextMenuStrip();

        menu.Items.Add(Strings.MenuOpen, null, (_, _) =>
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(_webBaseUrl)
            {
                UseShellExecute = true
            });
        });

        menu.Items.Add(new ToolStripSeparator());

        _signInItem = new ToolStripMenuItem(Strings.MenuSignIn, null, (_, _) =>
        {
            _auth.StartLoginFlow();
        });
        _signInItem.Visible = !_authenticated;
        menu.Items.Add(_signInItem);

        _signOutItem = new ToolStripMenuItem(Strings.MenuSignOut, null, (_, _) =>
        {
            _auth.OnUnauthorized();
        });
        _signOutItem.Visible = _authenticated;
        menu.Items.Add(_signOutItem);

        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(Strings.MenuAbout, null, async (_, _) =>
        {
            string? handle = null;
            if (_authenticated)
            {
                var me = await _client.GetMeAsync();
                handle = me.Name ?? me.Handle;
            }
            using var dialog = new AboutDialog(AppVersion(), handle, _webBaseUrl);
            dialog.ShowDialog();
        });

        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(Strings.MenuCheckUpdates, null, async (_, _) =>
        {
            await CheckForUpdatesAsync();
        });

        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(Strings.MenuExit, null, (_, _) =>
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
        _sessionMonitor.Dispose();
        _processor.Dispose();
        _detectableGames.Dispose();
    }
}
