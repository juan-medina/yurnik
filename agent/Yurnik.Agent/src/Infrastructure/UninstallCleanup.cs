// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using Yurnik.Agent.Auth;

namespace Yurnik.Agent.Infrastructure;

/// <summary>
/// Removes locally stored agent data on uninstall — "leave no trace".
/// Invoked from the Velopack before-uninstall hook in Program.cs.
/// </summary>
static class UninstallCleanup
{
    public static void Run(CredentialStore credentialStore, string dbPath)
    {
        credentialStore.DeleteToken();
        DeleteDatabaseFiles(dbPath);
    }

    /// <summary>
    /// Deletes the SQLite database and its WAL-mode sidecar files. Missing
    /// files are not an error.
    /// </summary>
    public static void DeleteDatabaseFiles(string dbPath)
    {
        foreach (var path in new[] { dbPath, dbPath + "-wal", dbPath + "-shm" })
        {
            try { File.Delete(path); }
            catch (IOException ex) { Log.Warn($"Uninstall cleanup: could not delete {path}: {ex.Message}"); }
        }
    }
}
