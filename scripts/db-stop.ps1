# scripts/db-stop.ps1
# Stops the local Postgres service.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok($msg)   { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [-] $msg" -ForegroundColor Cyan }
function Write-Err($msg)  { Write-Host "  [x] $msg" -ForegroundColor Red }


$service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $service) {
    Write-Err 'No Postgres service found.'
    exit 1
}

if ($service.Status -eq 'Stopped') {
    Write-Ok "Postgres ($($service.Name)) is already stopped"
    exit 0
}

Write-Info "Stopping $($service.Name)..."
Stop-Service $service.Name
Write-Ok 'Postgres stopped'
