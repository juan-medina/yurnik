# scripts/setup.ps1
# Checks all required dev tools and offers to install any that are missing.
# Safe to run multiple times.
# Must be run as Administrator (required for winget system-wide installs).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok($msg)     { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)    { Write-Host "  [x]  $msg" -ForegroundColor Red }
function Write-Info($msg)   { Write-Host "  [-]  $msg" -ForegroundColor Cyan }
function Write-Header($msg) { Write-Host "`n--- $msg" -ForegroundColor White }

function Confirm-Install($name) {
    $answer = Read-Host "  Install $name via winget? [y/n]"
    return $answer -eq 'y'
}

function Install-Winget($name, $id) {
    Write-Info "Installing $name..."
    winget install --id $id --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install $name. Install it manually and re-run this script."
        exit 1
    }
    Write-Ok "$name installed"
}

function Add-ToSystemPath($dir) {
    if (-not (Test-Path $dir)) { return }
    $current = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $parts   = $current -split ';' | Where-Object { $_ -ne '' }
    if ($parts -contains $dir) {
        Write-Ok "Already in system PATH: $dir"
        return
    }
    $newPath = ($parts + $dir) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'Machine')
    $env:PATH = "$env:PATH;$dir"
    Write-Ok "Added to system PATH: $dir"
}

# -- Admin check ---------------------------------------------------------------

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err 'This script must be run as Administrator.'
    Write-Host '  Right-click your terminal and select "Run as administrator", then try again.' -ForegroundColor Yellow
    exit 1
}

# -- winget --------------------------------------------------------------------

Write-Header 'Checking winget'
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err 'winget not found. Install App Installer from the Microsoft Store, then re-run this script.'
    Write-Info 'https://aka.ms/getwinget'
    exit 1
}
Write-Ok 'winget found'

# -- make ----------------------------------------------------------------------

Write-Header 'Checking make'
if (-not (where.exe make 2>$null)) {
    $makeReg = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\GnuWin32' -ErrorAction SilentlyContinue
    if (-not $makeReg) {
        Write-Warn 'make not found'
        if (Confirm-Install 'make') {
            Install-Winget 'make' 'GnuWin32.Make'
        } else {
            Write-Warn 'Skipping make -- run scripts directly from scripts\ instead'
        }
    }
    $makeReg = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\GnuWin32' -ErrorAction SilentlyContinue
    if ($makeReg) {
        Add-ToSystemPath (Join-Path $makeReg.InstallPath 'bin')
        Write-Ok 'make ready'
    }
} else {
    Write-Ok 'make found'
}

# -- Go ------------------------------------------------------------------------

Write-Header 'Checking Go'
$goCmd = Get-Command go -ErrorAction SilentlyContinue
if (-not $goCmd) {
    Write-Warn 'Go not found'
    if (Confirm-Install 'Go') {
        Install-Winget 'Go' 'GoLang.Go'
    } else {
        Write-Warn 'Skipping Go -- the API will not build without it'
    }
} else {
    $goVersion = & go version
    if ($goVersion -match 'go(\d+)\.(\d+)') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -gt 1 -or ($major -eq 1 -and $minor -ge 26)) {
            Write-Ok "Go found: $goVersion"
        } else {
            Write-Err "Go version too old: $goVersion (need 1.26 or higher)"
            Write-Info 'Run: winget upgrade GoLang.Go'
            exit 1
        }
    } else {
        Write-Ok "Go found: $goVersion"
    }
}

# -- golangci-lint -------------------------------------------------------------

Write-Header 'Checking golangci-lint'
if (-not (Get-Command golangci-lint -ErrorAction SilentlyContinue)) {
    Write-Warn 'golangci-lint not found'
    if (Confirm-Install 'golangci-lint') {
        Install-Winget 'golangci-lint' 'GolangCI.golangci-lint'
    } else {
        Write-Warn 'Skipping golangci-lint -- linting will not work'
    }
} else {
    $lintVersion = & golangci-lint --version
    Write-Ok "golangci-lint found: $lintVersion"
}

# -- .NET 9 --------------------------------------------------------------------

Write-Header 'Checking .NET 9'
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCmd) {
    Write-Warn '.NET not found'
    if (Confirm-Install '.NET 9 SDK') {
        Install-Winget '.NET 9 SDK' 'Microsoft.DotNet.SDK.9'
    } else {
        Write-Warn 'Skipping .NET 9 -- the tray agent will not build without it'
    }
} else {
    $sdks = & dotnet --list-sdks
    if ($sdks -match '^9\.') {
        Write-Ok '.NET 9 SDK found'
    } else {
        Write-Warn ".NET 9 SDK not found in installed SDKs (need 9.x):"
        $sdks | ForEach-Object { Write-Info "  $_" }
        if (Confirm-Install '.NET 9 SDK') {
            Install-Winget '.NET 9 SDK' 'Microsoft.DotNet.SDK.9'
        } else {
            Write-Warn 'Skipping .NET 9 -- the tray agent will not build without it'
        }
    }
}

# -- nvm -----------------------------------------------------------------------

Write-Header 'Checking nvm'
$nvmCmd = Get-Command nvm -ErrorAction SilentlyContinue
if (-not $nvmCmd) {
    Write-Warn 'nvm not found'
    Write-Info 'Install nvm for Windows from: https://github.com/coreybutler/nvm-windows/releases'
    Write-Info 'Then re-run this script to continue with Node and pnpm setup.'
} else {
    Write-Ok 'nvm found'

    Write-Header 'Checking Node 22'
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Warn 'Node not found'
        $answer = Read-Host '  Install Node 22 via nvm? [y/n]'
        if ($answer -eq 'y') {
            & nvm install 22
            & nvm use 22
            Write-Ok 'Node 22 installed'
        } else {
            Write-Warn 'Skipping Node -- the frontend will not build without it'
        }
    } else {
        $nodeVersion = & node --version
        if ($nodeVersion -match '^v22\.') {
            Write-Ok "Node found: $nodeVersion"
        } else {
            Write-Warn "Node found but version does not match: $nodeVersion (need v22.x)"
            $answer = Read-Host '  Switch to Node 22 via nvm? [y/n]'
            if ($answer -eq 'y') {
                & nvm install 22
                & nvm use 22
                Write-Ok 'Switched to Node 22'
            } else {
                Write-Warn 'Skipping -- frontend may not build on this Node version'
            }
        }
    }

    Write-Header 'Checking pnpm'
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Warn 'pnpm not found'
        $answer = Read-Host '  Install pnpm via npm? [y/n]'
        if ($answer -eq 'y') {
            & npm install -g pnpm
            Write-Ok 'pnpm installed'
        } else {
            Write-Warn 'Skipping pnpm -- the frontend will not build without it'
        }
    } else {
        $pnpmVersion = & pnpm --version
        Write-Ok "pnpm found: $pnpmVersion"
    }
}

# -- Postgres ------------------------------------------------------------------

function Set-PostgresServiceConfig {
    $service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $service) { return }

    # Set startup type to Manual
    Set-Service $service.Name -StartupType Manual
    Write-Ok "Postgres service set to Manual startup"

    # Grant Built-in Users start/stop rights if not already set
    $sddl = (sc.exe sdshow $service.Name) -join ''
    if ($sddl -notlike '*(A;;RPWP;;;BU)*') {
        $ace     = '(A;;RPWP;;;BU)'
        $newSddl = $sddl -replace 'S:\(', "$ace`S:("
        sc.exe sdset $service.Name $newSddl | Out-Null
        Write-Ok "Granted start/stop rights to all users"
    } else {
        Write-Ok "Start/stop rights already granted to all users"
    }

    # Stop the service -- developer starts it manually when needed
    if ($service.Status -eq 'Running') {
        Stop-Service $service.Name
        Write-Ok "Postgres service stopped -- use: make db-start"
    }
}

Write-Header 'Checking Postgres'
$reg = Get-ItemProperty 'HKLM:\SOFTWARE\PostgreSQL\Installations\*' -ErrorAction SilentlyContinue |
       Select-Object -First 1

if (-not $reg) {
    Write-Warn 'Postgres not found'
    if (Confirm-Install 'Postgres 16') {
        Install-Winget 'Postgres 16' 'PostgreSQL.PostgreSQL.16'
        $reg = Get-ItemProperty 'HKLM:\SOFTWARE\PostgreSQL\Installations\*' -ErrorAction SilentlyContinue |
               Select-Object -First 1
    } else {
        Write-Warn 'Skipping Postgres -- the API will not run without a database'
    }
}

if ($reg) {
    $pgBin = Join-Path $reg.'Base Directory' 'bin'
    Add-ToSystemPath $pgBin
    Set-PostgresServiceConfig
    $pgVersion = & (Join-Path $pgBin 'psql.exe') --version
    Write-Ok "Postgres ready: $pgVersion"
}

# -- Done ----------------------------------------------------------------------

Write-Host ''
Write-Ok 'Setup check complete.'
Write-Info 'Next steps if this is your first time:'
Write-Info '  make db-start   -- start Postgres'
Write-Info '  make db-init    -- create database and generate .env'
Write-Info '  make api        -- run the API server'
