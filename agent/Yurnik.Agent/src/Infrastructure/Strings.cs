// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Resources;

namespace Yurnik.Agent.Infrastructure;

// Thin wrapper around the localized resource files (Resources/Strings.resx + Strings.es.resx).
// ResourceManager selects the correct culture at runtime via CultureInfo.CurrentUICulture.
static class Strings
{
    static readonly ResourceManager _manager = new(
        "Yurnik.Agent.Resources.Strings",
        typeof(Strings).Assembly);

    public static string TrayStarting       => Get(nameof(TrayStarting));
    public static string TraySignInRequired => Get(nameof(TraySignInRequired));
    public static string TrayReady          => Get(nameof(TrayReady));
    public static string TrayUpdateAvailable => Get(nameof(TrayUpdateAvailable));
    public static string BalloonSignIn      => Get(nameof(BalloonSignIn));
    public static string MenuOpen           => Get(nameof(MenuOpen));
    public static string MenuSignIn         => Get(nameof(MenuSignIn));
    public static string MenuSignOut        => Get(nameof(MenuSignOut));
    public static string MenuAbout          => Get(nameof(MenuAbout));
    public static string MenuCheckUpdates   => Get(nameof(MenuCheckUpdates));
    public static string MenuSyncSettings   => Get(nameof(MenuSyncSettings));
    public static string MenuExit           => Get(nameof(MenuExit));
    public static string AboutTitle         => Get(nameof(AboutTitle));
    public static string AboutTagline       => Get(nameof(AboutTagline));
    public static string AboutNotSignedIn   => Get(nameof(AboutNotSignedIn));

    public static string AboutSignedInAs(string handle) =>
        string.Format(Get(nameof(AboutSignedInAs)), handle);

    public static string BalloonUpdateAvailable(string version) =>
        string.Format(Get(nameof(BalloonUpdateAvailable)), version);

    static string Get(string name) => _manager.GetString(name) ?? name;
}
