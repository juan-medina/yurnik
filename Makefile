.PHONY: run-api run-agent run-web test test-api test-agent test-web build build-api build-web build-agent gen-keys lint setup db-init db-start db-stop

run-api:
	powershell -ExecutionPolicy Bypass -File scripts/run-api.ps1

run-agent:
	cd agent && dotnet run --project Agon.Agent

run-web:
	powershell -ExecutionPolicy Bypass -File scripts/run-web.ps1

test: test-api test-agent test-web

test-api:
	cd api && go test ./... -v

test-agent:
	cd agent && dotnet test Agon.sln

test-web:
	cd web && pnpm test --run

build: build-api build-web build-agent

build-api:
	cd api && go build -o bin/api ./cmd/api

build-web:
	cd web && pnpm build

build-agent:
	cd agent && dotnet publish Agon.Agent/Agon.Agent.csproj -c Release

gen-keys:
	cd api && go run ./cmd/gen-keys

lint:
	cd web && pnpm lint

setup:
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

db-init:
	powershell -ExecutionPolicy Bypass -File scripts/db-init.ps1

db-start:
	powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1

db-stop:
	powershell -ExecutionPolicy Bypass -File scripts/db-stop.ps1
