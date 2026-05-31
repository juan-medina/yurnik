.PHONY: web api run-api gen-keys test lint build setup db-init db-start db-stop

web:
	powershell -ExecutionPolicy Bypass -File scripts/run-web.ps1

api: run-api

api:
	powershell -ExecutionPolicy Bypass -File scripts/run-api.ps1

gen-keys:
	cd api && go run ./cmd/gen-keys

test:
	cd api && go test ./... -v
	cd web && pnpm test

lint:
	cd web && pnpm lint

build:
	cd web && pnpm build

setup:
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

db-init:
	powershell -ExecutionPolicy Bypass -File scripts/db-init.ps1

db-start:
	powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1

db-stop:
	powershell -ExecutionPolicy Bypass -File scripts/db-stop.ps1
