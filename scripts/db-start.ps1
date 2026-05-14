# scripts/db-start.ps1
# Starts the local Postgres service.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok($msg)   { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [-] $msg" -ForegroundColor Cyan }
function Write-Err($msg)  { Write-Host "  [x] $msg" -ForegroundColor Red }


$service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $service) {
    Write-Err 'No Postgres service found. Install Postgres first: scripts\setup.ps1'
    exit 1
}

if ($service.Status -eq 'Running') {
    Write-Ok "Postgres ($($service.Name)) is already running"
    exit 0
}

Write-Info "Starting $($service.Name)..."
Start-Service $service.Name
Write-Ok 'Postgres started'
