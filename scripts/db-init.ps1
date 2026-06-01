# scripts/db-init.ps1
# Initialises the local dev database and writes DATABASE_URL / DATABASE_ADMIN_URL into .env.
# On first run, seeds .env from .env.example if it does not exist yet.
# Safe to run multiple times -- only the two DB vars are ever overwritten.
# Requires Postgres to be installed and running. Run setup.ps1 first.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok($msg)   { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [-]  $msg" -ForegroundColor Cyan }
function Write-Err($msg)  { Write-Host "  [x]  $msg" -ForegroundColor Red }

function New-RandomPassword {
    $rng   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 24
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', ''
}

$repoRoot   = Split-Path $PSScriptRoot -Parent
$envFile    = Join-Path $repoRoot '.env'
$envExample = Join-Path $repoRoot '.env.example'
$sqlFile    = Join-Path $PSScriptRoot 'db-init.sql'

. (Join-Path $PSScriptRoot "Load-Env.ps1")

# -- Check Postgres service is present -----------------------------------------

$service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $service) {
    Write-Err 'No Postgres service found. Install Postgres first: scripts\setup.ps1'
    exit 1
}
Write-Ok "Postgres service found ($($service.Name))"

# -- Check psql is available ---------------------------------------------------

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Err 'psql not found in PATH. Restart your terminal after running setup.ps1'
    exit 1
}

# -- Check Postgres is running -------------------------------------------------

$env:PGPASSWORD = 'postgres'
$ErrorActionPreference = 'Continue'
$output = & psql -U postgres -c '\q' 2>&1
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) {
    Write-Err 'Cannot connect to Postgres. Is it running? Try: make db-start'
    exit 1
}
Write-Ok 'Postgres is running'

# -- Generate passwords --------------------------------------------------------

$adminPassword = New-RandomPassword
$apiPassword   = New-RandomPassword

# -- Run the SQL ---------------------------------------------------------------

Write-Info 'Initialising database...'

& psql -U postgres -f $sqlFile
if ($LASTEXITCODE -ne 0) {
    Write-Err 'Database initialisation failed. See errors above.'
    exit 1
}

& psql -U postgres -c "ALTER ROLE yurnik_admin WITH PASSWORD '$adminPassword';"
& psql -U postgres -c "ALTER ROLE yurnik_api WITH PASSWORD '$apiPassword';"

Write-Ok 'Database initialised'

# -- Write .env ----------------------------------------------------------------

# Seed from .env.example on first run so all vars are present.
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Info '.env created from .env.example'
}

# Only touch the two DB vars -- everything else in .env is left as-is.
Set-EnvLine $envFile 'DATABASE_URL'       "postgres://yurnik_api:$apiPassword@localhost:5432/yurnik_dev"
Set-EnvLine $envFile 'DATABASE_ADMIN_URL' "postgres://yurnik_admin:$adminPassword@localhost:5432/yurnik_dev"

Write-Ok '.env updated (DATABASE_URL, DATABASE_ADMIN_URL)'
Write-Host ''
Write-Ok 'Dev database ready.'
Write-Info 'Fill in IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in .env before running the API.'
