.PHONY: help install lint build dev preview clean

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install frontend dependencies
	cd frontend && npm install

lint: ## Type check the frontend
	cd frontend && npm run lint

build: ## Type check and build the frontend into frontend/dist
	cd frontend && npm run build

dev: ## Start the frontend development server
	cd frontend && npm run dev

preview: ## Serve the production build locally
	cd frontend && npm run preview

clean: ## Remove build artifacts
	rm -rf frontend/dist frontend/node_modules
