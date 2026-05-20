MAKE=make

include ./.env
export $(shell sed 's/=.*//' ./.env)

INFRA_DIR := $(CURDIR)/infra
FRONTEND_PORT := 5173

build-backend:
	which node
	node --version
	npm run build:backend

build-frontend:
	npm run build:frontend


run:
	cd infra && $(MAKE) all-up

run-with-smoke:
	cd infra && $(MAKE) all-up-with-smoke

run-build-smoke:
	cd infra && $(MAKE) all-up-build-smoke

run-build:
	cd infra && $(MAKE) all-up-build

run-build-nocache:
	cd infra && $(MAKE) all-up-build-nocache

stop:
	cd infra && $(MAKE) all-down
	cd infra && docker system prune -f

logs:
	cd infra && $(MAKE) logs-show

logs-follow:
	cd infra && $(MAKE) logs-all

logs-backend:
	cd infra && $(MAKE) logs

logs-frontend:
	cd infra && $(MAKE) logs-frontend


setup:
	npm install
	npm run e2e-setup

.PHONY: build
build:
	npm run build

format:
	npm run lint

format-fix:
	npm run lint:fix

test:
	npm run test

smoke-test:
	@echo "🧪 Running smoke test..."
	cd infra && npm run test:smoke

e2e-test:
	@echo "Running Playwright e2e tests via docker-compose smoke profile..."
	cd "$(INFRA_DIR)" && docker compose down --remove-orphans || true
	cd "$(INFRA_DIR)" && docker compose up -d --build postgres qdrant temporal temporal-ui temporal-worker backend frontend
	cd "$(INFRA_DIR)" && docker compose run --rm smoke-test; \
	TEST_EXIT_CODE=$$?; \
	cd "$(INFRA_DIR)" && docker compose down --remove-orphans || true; \
	exit $$TEST_EXIT_CODE

	
check: 
	make format
	make test
	make build

publish: 
	npm publish --access public

prepare-db:
	echo "CREATE EXTENSION IF NOT EXISTS vector;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin

reset:
	echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin
	echo "CREATE EXTENSION IF NOT EXISTS vector;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin
	npx prisma db push --schema=./prisma/schema.prisma
	npx prisma generate --schema=./prisma/schema.prisma
	npx prisma db seed --schema=./prisma/schema.prisma

reset-docker:
	cd infra && bash -c 'set -a && source ../.env && set +a && echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS vector;" | docker compose exec -T postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB'
	cd infra && bash -c 'set -a && source ../.env && set +a && docker compose exec backend npx prisma db push --schema=infra/prisma/schema.prisma --accept-data-loss'
	cd infra && bash -c 'set -a && source ../.env && set +a && docker compose exec backend npx tsx infra/prisma/seed.ts'

run-clean-backend:
	make reset
	npm run dev:backend

	
m ?= wip
push:
	make check
	git add .
	git commit -m "$(m)"
	git push

dockertest:
	docker run fos_img

seed-live-db:
	@echo "🔌 Starting Cloud SQL Proxy..."
	@$(CURDIR)/infra/terraform/cloud-sql-proxy $(GCP_PROJECT):$(GCP_REGION):fos-postgres-dev --port=5433 & \
	PROXY_PID=$$!; \
	echo "⏳ Waiting for proxy to establish connection..."; \
	sleep 5; \
	echo "🌱 Running database seed..."; \
	DATABASE_URL="postgresql://fosuser:k*6+nb$$p^2G4KMtw@localhost:5433/fosdb" npx prisma db seed --schema=./infra/prisma/schema.prisma || SEED_EXIT=$$?; \
	echo "🛑 Stopping Cloud SQL Proxy (PID: $$PROXY_PID)..."; \
	kill $$PROXY_PID 2>/dev/null || true; \
	wait $$PROXY_PID 2>/dev/null || true; \
	echo "✅ Done!"; \
	exit $$SEED_EXIT

# ============================================
# Tauri Desktop App Commands
# ============================================

LOG_DIR := $(CURDIR)/logs
TAURI_LOG := $(LOG_DIR)/tauri-dev.log

# Run Tauri in development mode
# Clears Vite cache and rebuilds frontend before starting
# Default: opens in home directory. Override with DIR=. or DIR=/path/to/dir
# Logs detailed application and JS console output to $(TAURI_LOG)
DIR ?= $(HOME)
tauri-dev:
	@echo "🧹 Cleaning Vite cache..."
	rm -rf frontend/node_modules/.vite frontend/dist 2>/dev/null || true
	@echo "🔨 Rebuilding frontend..."
	cd frontend && npm run build
	@mkdir -p $(LOG_DIR)
	@echo "🚀 Starting Tauri dev with verbose logging (logging to $(TAURI_LOG))..."
	@echo "=== Tauri Dev Started: $$(date) ===" > $(TAURI_LOG)
	@echo "=== Environment: RUST_LOG=debug RUST_BACKTRACE=1 ===" >> $(TAURI_LOG)
	RUST_LOG=debug RUST_BACKTRACE=1 FOS_TARGET_DIR=$$(realpath $(DIR)) cd desktop && npm run dev 2>&1 | tee -a $(TAURI_LOG)

# View tauri logs
tauri-logs:
	@tail -f $(TAURI_LOG)

# Build Tauri production release
tauri-build:
	cd desktop && npm run build

# Build everything (frontend + backend + desktop)
build-all:
	npm run build:frontend
	npm run build:backend
	cd desktop && npm run build

# Run dev for everything (frontend dev server + Tauri)
dev-desktop:
	cd desktop && npm run dev

# Just rebuild frontend (useful if only frontend changed)
rebuild-frontend:
	npm run build:frontend

# Install Tauri CLI globally if needed
tauri-setup:
	cargo install tauri-cli

# Clean Tauri build artifacts
tauri-clean:
	cd desktop/src-tauri && cargo clean

# Reset all local Fosforescent data (local .fos, ~/.fos, caches, IndexedDB)
reset-local:
	@echo "🧹 Resetting all local Fosforescent data..."
	@rm -rf .fos 2>/dev/null || true
	@rm -rf ~/.fos 2>/dev/null || true
	@rm -rf ~/.cache/com.fosforescent.desktop 2>/dev/null || true
	@rm -rf ~/.local/share/com.fosforescent.desktop 2>/dev/null || true
	@rm -rf ~/.config/com.fosforescent.desktop 2>/dev/null || true
	@rm -rf frontend/node_modules/.vite 2>/dev/null || true
	@rm -rf frontend/dist 2>/dev/null || true
	@echo "✅ Reset complete. Run 'make tauri-dev' to start fresh."
