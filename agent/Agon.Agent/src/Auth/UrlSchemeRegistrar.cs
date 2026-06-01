// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Microsoft.Win32;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Auth;

/// <summary>
/// Registers the agon:// custom URL scheme in HKCU so the OS routes
/// agon:// URLs to this exe. Idempotent — safe to call on every startup.
/// No admin rights required (HKCU only).
/// </summary>
static class UrlSchemeRegistrar
{
    public static void Register()
    {
        var exePath = Environment.ProcessPath
            ?? Path.Combine(AppContext.BaseDirectory, "Agon.Agent.exe");

        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\agon");
            key.SetValue("", "URL:Agon Protocol");
            key.SetValue("URL Protocol", "");

            using var iconKey = key.CreateSubKey("DefaultIcon");
            iconKey.SetValue("", $"\"{exePath}\",0");

            using var commandKey = key.CreateSubKey(@"shell\open\command");
            commandKey.SetValue("", $"\"{exePath}\" \"%1\"");

            Log.Info("agon:// URL scheme registered");
        }
        catch (Exception ex)
        {
            Log.Error("Failed to register agon:// URL scheme", ex);
        }
    }
}
