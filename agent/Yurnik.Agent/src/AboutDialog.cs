// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Infrastructure;

namespace Yurnik.Agent;

sealed class AboutDialog : Form
{
    public AboutDialog(string version, string? handle, string webBaseUrl)
    {
        Text = Strings.AboutTitle;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(340, 230);
        ShowInTaskbar = false;

        // Window icon — tray icon
        var iconStream = typeof(AboutDialog).Assembly
            .GetManifestResourceStream("Yurnik.Agent.Resources.tray.ico");
        if (iconStream is not null)
            Icon = new Icon(iconStream);

        // Logo image — full-resolution PNG
        var logoStream = typeof(AboutDialog).Assembly
            .GetManifestResourceStream("Yurnik.Agent.Resources.logo.png");
        var logoImage = logoStream is not null ? Image.FromStream(logoStream) : Icon?.ToBitmap();

        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(20),
            RowCount = 5,
            ColumnCount = 1,
        };
        panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));  // logo
        panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));  // title
        panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));  // tagline
        panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));  // version/status
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 36)); // link — fixed height for click target

        // Logo
        if (logoImage is not null)
        {
            var logo = new PictureBox
            {
                Image = logoImage,
                SizeMode = PictureBoxSizeMode.Zoom,
                Size = new Size(64, 64),
                Anchor = AnchorStyles.None,
            };
            panel.Controls.Add(logo, 0, 0);
        }

        // App name
        panel.Controls.Add(new Label
        {
            Text = "Yurnik",
            Font = new Font("Segoe UI", 16, FontStyle.Bold),
            AutoSize = true,
            Anchor = AnchorStyles.None,
            TextAlign = ContentAlignment.MiddleCenter,
        }, 0, 1);

        // Tagline
        panel.Controls.Add(new Label
        {
            Text = Strings.AboutTagline,
            Font = new Font("Segoe UI", 9),
            AutoSize = true,
            Anchor = AnchorStyles.None,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = SystemColors.GrayText,
        }, 0, 2);

        // Version + auth status
        var status = handle is not null
            ? Strings.AboutSignedInAs(handle)
            : Strings.AboutNotSignedIn;
        panel.Controls.Add(new Label
        {
            Text = $"v{version}  ·  {status}",
            Font = new Font("Segoe UI", 9),
            AutoSize = true,
            Anchor = AnchorStyles.None,
            TextAlign = ContentAlignment.MiddleCenter,
        }, 0, 3);

        // Website link — Dock=Fill so the entire row cell is the click target
        var link = new LinkLabel
        {
            Text = "yurnik.social",
            Font = new Font("Segoe UI", 9),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Padding = new Padding(0, 6, 0, 0),
        };
        link.LinkClicked += (_, _) =>
            System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo(webBaseUrl) { UseShellExecute = true });
        panel.Controls.Add(link, 0, 4);

        // Copyright — added directly to form so it sits at the very bottom
        var copyright = new Label
        {
            Text = "© 2026 Juan Medina",
            Font = new Font("Segoe UI", 8),
            Dock = DockStyle.Bottom,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = SystemColors.GrayText,
            Height = 24,
            Padding = new Padding(0, 0, 0, 4),
        };
        Controls.Add(copyright);

        Controls.Add(panel);
    }
}
