// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Win32;
using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent.Auth;

/// <summary>
/// Registers the yurnik:// custom URL scheme in HKCU so the OS routes
/// yurnik:// URLs to this exe. Idempotent — safe to call on every startup.
/// No admin rights required (HKCU only).
/// </summary>
static class UrlSchemeRegistrar
{
    public static void Register()
    {
        var exePath = Environment.ProcessPath
            ?? Path.Combine(AppContext.BaseDirectory, "Yurnik.Agent.exe");

        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\yurnik");
            key.SetValue("", "URL:Yurnik Protocol");
            key.SetValue("URL Protocol", "");

            using var iconKey = key.CreateSubKey("DefaultIcon");
            iconKey.SetValue("", $"\"{exePath}\",0");

            using var commandKey = key.CreateSubKey(@"shell\open\command");
            commandKey.SetValue("", $"\"{exePath}\" \"%1\"");

            Log.Info("yurnik:// URL scheme registered");
        }
        catch (Exception ex)
        {
            Log.Error("Failed to register yurnik:// URL scheme", ex);
        }
    }
}
