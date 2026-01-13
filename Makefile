.PHONY: help install build run dev clean

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install frontend dependencies
	cd frontend && npm install

build: ## Build the frontend and backend
	cd frontend && npm run build
	rm -rf dist
	cp -r frontend/dist .
	cd backend && go build -o ../server ./cmd/server

run: build ## Run the backend server (serves the built frontend)
	./server

dev: ## Start the frontend and backend development servers
	@echo "Starting frontend and backend dev servers..."
	@cd frontend && npm run dev & \
	cd backend && go run cmd/server/main.go

clean: ## Remove frontend and backend build artifacts
	rm -rf frontend/dist frontend/node_modules server dist

fmt: ## Format backend Go code
	cd backend && go fmt ./...

vet: ## Vet backend Go code for common errors
	cd backend && go vet ./...

test: ## Run backend Go tests
	cd backend && go test ./...

docker-build: ## Build the Docker image
	docker build -t beers-app .

docker-run: ## Run the application in a Docker container
	docker run --env-file .env -p 8080:8080 beers-app

docker-compose-up: ## Start the application with Docker Compose
	docker compose up -d --build

docker-compose-down: ## Stop the application with Docker Compose
	docker compose down
