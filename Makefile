.PHONY: run-api run-agent run-web test test-api test-agent test-web test-integration build build-api build-web build-agent deploy-api release-agent gen-keys lint setup db-init db-migrate db-start db-stop

ifeq ($(OS),Windows_NT)
PLATFORM := windows
else
PLATFORM := linux
endif

run-api:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/run-api.ps1
else
	bash scripts/run-api.sh
endif

run-agent:
	cd agent && dotnet run --project Yurnik.Agent

run-web:
	powershell -ExecutionPolicy Bypass -File scripts/run-web.ps1

test: test-api test-agent test-web

test-api:
	cd api && go test ./... -v

test-agent:
	cd agent && dotnet test Yurnik.sln

test-web:
	cd web && pnpm test --run

test-integration:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/test-integration.ps1
else
	bash scripts/test-integration.sh
endif

build: build-api build-web build-agent

build-api:
ifeq ($(YURNIK_ENV),production)
	cd api && go build -o /usr/local/bin/yurnik-api ./cmd/api
else
	cd api && go build -o bin/api ./cmd/api
endif

build-web:
	cd web && pnpm build

build-agent:
	cd agent && dotnet publish Yurnik.Agent/Yurnik.Agent.csproj -c Release

deploy-api:
	bash scripts/deploy-api.sh

release-agent:
	powershell -ExecutionPolicy Bypass -File agent/release.ps1

gen-keys:
	cd api && go run ./cmd/gen-keys

lint:
	cd web && pnpm lint

setup:
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

db-init:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/db-init.ps1
else
	bash scripts/db-init.sh
endif

db-migrate:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/db-migrate.ps1
else
	bash scripts/db-migrate.sh
endif

db-start:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1
else
	bash scripts/db-start.sh
endif

db-stop:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/db-stop.ps1
else
	bash scripts/db-stop.sh
endif
