# Agon.Agent

Windows tray agent for Agōn. Detects running games via graphics API DLL enumeration and creates pending journeys via the API.

## Requirements

- .NET 9 SDK
- Windows (WinForms, Windows Credential Manager)

## Development

```sh
# Build
dotnet build Agon.sln

# Run (debug — allocates a console window for log output)
dotnet run --project Agon.Agent

# Test
dotnet test Agon.sln
```

## Structure

```
Agon.Agent/
  src/
    Program.cs              — entry point, wires everything
    TrayApp.cs              — NotifyIcon, app lifetime
    Auth/
      AuthManager.cs        — token lifecycle, re-auth flow
      CredentialStore.cs    — Windows Credential Manager wrapper
      UrlSchemeListener.cs  — named pipe, receives agon:// from second instance
      UrlSchemeRegistrar.cs — writes agon:// to HKCU registry
    Detection/
      ProcessWatcher.cs     — polls processes for graphics DLLs
    Queue/
      EventQueue.cs         — SQLite-backed event queue
      QueueProcessor.cs     — drains queue, merges sessions, sends to API
    Api/
      AgonClient.cs         — typed HTTP client
    Infrastructure/
      AgentConfig.cs        — configuration
      Database.cs           — SQLite setup and migrations
      Log.cs                — file + stdout (debug) logger
      NativeMethods.cs      — P/Invoke declarations

Agon.Agent.Tests/           — xUnit tests
```

## Configuration

Settings are read from `appsettings.json` (committed, production values) next to the exe.
Create `appsettings.Development.json` (gitignored) in the same directory to override for local dev:

```json
{
  "ApiBaseUrl": "http://127.0.0.1:8080",
  "WebBaseUrl": "http://127.0.0.1:5173"
}
```

`appsettings.Development.json` is never included in a `dotnet publish` output.

## Log file

`%APPDATA%\Agon\agon.log` — always written. In debug builds, also printed to stdout.

## First run

1. Agent registers `agon://` URL scheme in HKCU (no admin required)
2. Checks Windows Credential Manager for a stored token
3. No token → opens browser to `{web}/auth/agent`, waits for `agon://auth?token=…` callback
4. Token received → validated against API, stored in Credential Manager
5. ProcessWatcher and QueueProcessor start
