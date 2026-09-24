# SPDX-FileCopyrightText: 2026 Juan Medina
# SPDX-License-Identifier: MIT

$ErrorActionPreference = "Continue"
$agentDir = Join-Path $PSScriptRoot "..\agent"

Write-Host "Running agent startup smoke test..."
Push-Location $agentDir
try {
    $output = & dotnet run --project Yurnik.Agent -- --smoke-test 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host "[-] Smoke test failed: agent exited with code $exitCode" -ForegroundColor Red
        if ($output) {
            Write-Host $output
        }
        exit $exitCode
    }
    Write-Host "[ok] Smoke test passed" -ForegroundColor Green
}
finally {
    Pop-Location
}
