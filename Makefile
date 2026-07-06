.PHONY: run-api run-maintenance run-agent run-web test test-api test-maintenance test-agent test-web test-integration test-integration-api test-integration-maintenance build build-api build-maintenance build-web build-agent deploy-api deploy-maintenance deploy-web release-agent gen-keys export-user lint setup db-init db-migrate db-force db-start db-stop

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

run-maintenance:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/run-maintenance.ps1
else
	bash scripts/run-maintenance.sh
endif

run-agent:
	cd agent && dotnet run --project Yurnik.Agent

run-web:
	powershell -ExecutionPolicy Bypass -File scripts/run-web.ps1

test: test-api test-maintenance test-agent test-web

test-api:
	cd api && go test ./cmd/api/... ./internal/... -v

test-maintenance:
	cd api && go test ./cmd/maintenance/... -v

test-agent:
	cd agent && dotnet test Yurnik.sln

test-web:
	cd web && pnpm test --run

test-integration-api:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/test-integration.ps1 ./cmd/api/... ./internal/...
else
	bash scripts/test-integration.sh ./cmd/api/... ./internal/...
endif

test-integration-maintenance:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/test-integration.ps1 ./cmd/maintenance/...
else
	bash scripts/test-integration.sh ./cmd/maintenance/...
endif

test-integration: test-integration-api test-integration-maintenance

build: build-api build-maintenance build-web build-agent

build-api:
ifeq ($(YURNIK_ENV),production)
	cd api && go build -o /usr/local/bin/yurnik-api ./cmd/api
else
	cd api && go build -o bin/api ./cmd/api
endif

build-maintenance:
ifeq ($(YURNIK_ENV),production)
	cd api && go build -o /usr/local/bin/yurnik-maintenance ./cmd/maintenance
else
	cd api && go build -o bin/maintenance ./cmd/maintenance
endif

build-web:
	cd web && pnpm build

build-agent:
	cd agent && dotnet publish Yurnik.Agent/Yurnik.Agent.csproj -c Release

deploy-api:
	bash scripts/deploy-api.sh

deploy-maintenance:
	bash scripts/deploy-maintenance.sh

deploy-web:
	cd web && pnpm run deploy

release-agent:
	powershell -ExecutionPolicy Bypass -File agent/release.ps1

gen-keys:
	cd api && go run ./cmd/gen-keys

# Usage: make export-user USER=<handle-or-uuid> [OUT=<output-file>]
export-user:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/export-user.ps1 $(USER) $(OUT)
else
	bash scripts/export-user.sh $(USER) $(OUT)
endif

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

db-force:
ifeq ($(PLATFORM),windows)
	powershell -ExecutionPolicy Bypass -File scripts/db-force.ps1 $(VERSION)
else
	bash scripts/db-force.sh $(VERSION)
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
