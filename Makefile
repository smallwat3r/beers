
.DEFAULT_GOAL := help
.PHONY: help install build run dev clean

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install frontend dependencies
	cd frontend && npm install

build: ## Build the frontend for production
	cd frontend && npm run build

run: build ## Run the backend server (serves the built frontend)
	cd backend && go run cmd/server/main.go

dev: ## Start the frontend and backend development servers
	@echo "Starting frontend and backend dev servers..."
	@cd frontend && npm run dev & \
	cd backend && go run cmd/server/main.go

clean: ## Remove frontend and backend build artifacts
	rm -rf frontend/dist frontend/node_modules

fmt: ## Format backend Go code
	cd backend && go fmt ./...

vet: ## Vet backend Go code for common errors
	cd backend && go vet ./...
