.PHONY: api agent web test lint

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
	go vet ./...
	cd web && pnpm lint

build:
	go build -o bin/api ./cmd/api
	go build -o bin/agent ./cmd/agent
	cd web && pnpm build
