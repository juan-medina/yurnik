.PHONY: api agent web test lint build setup db-init db-start db-stop

api:
	go run ./cmd/api

agent:
	go run ./cmd/agent

web:
	cd web && pnpm dev

test:
	go test ./...
	cd web && pnpm test

lint:
	golangci-lint run ./...
	cd web && pnpm lint

build:
	go build -o bin/api ./cmd/api
	go build -o bin/agent ./cmd/agent
	cd web && pnpm build

setup:
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

db-init:
	powershell -ExecutionPolicy Bypass -File scripts/db-init.ps1

db-start:
	powershell -ExecutionPolicy Bypass -File scripts/db-start.ps1

db-stop:
	powershell -ExecutionPolicy Bypass -File scripts/db-stop.ps1
