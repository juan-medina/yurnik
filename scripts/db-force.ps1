# SPDX-FileCopyrightText: 2026 Juan Medina
# SPDX-License-Identifier: MIT

param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

. (Join-Path $PSScriptRoot "Load-Env.ps1")
Import-DotEnv (Join-Path $PSScriptRoot "..\.env")

Set-Location (Join-Path $PSScriptRoot "..\api")
go run ./cmd/migrate force $Version
