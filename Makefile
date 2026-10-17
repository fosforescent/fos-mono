MAKE=make

include ./.env
export $(shell sed 's/=.*//' ./.env)
LOG_DIR := $(CURDIR)/logs
INFRA_DIR := $(CURDIR)/infra
TAURI_LOG := $(LOG_DIR)/tauri-dev.log

build-backend:
	which node
	node --version
	npm run build:backend

build-web:
	npm run build:web


run:
	cd infra && $(MAKE) all-up

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


setup:
	npm install

.PHONY: build
build:
	npm run build

format:
	npm run lint

format-fix:
	npm run lint:fix

test:
	npm run test

	
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



# Run Tauri in development mode
# Clears Vite cache and rebuilds web frontend before starting
# Default: opens in home directory. Override with DIR=. or DIR=/path/to/dir
# Logs detailed application and JS console output to $(TAURI_LOG)
DIR ?= $(HOME)
export DIR PROD_API_URL
tauri-dev:
	node scripts/tauri-dev.cjs

# Run Tauri dev pointed at the production backend API.
# Note: the web UI persists the API URL in webview localStorage
# ('web-mini.api-url'); a previously stored value overrides this env var.
# Clear it via devtools (localStorage.removeItem('web-mini.api-url')) or
# `make reset-local` if the app keeps using an old URL.
PROD_API_URL ?= https://api.fosforescent.com
tauri-dev-prod:
	node scripts/tauri-dev.cjs --prod

# View tauri logs
tauri-logs:
	@tail -f $(TAURI_LOG)

# Build Tauri production release
tauri-build:
	cd desktop && npm run build

# Build everything (web + backend + desktop)
build-all:
	npm run build:web
	npm run build:backend
	cd desktop && npm run build

# Run dev for everything (web dev server + Tauri)
dev-desktop:
	cd desktop && npm run dev

# Just rebuild the web frontend used by Tauri (useful if only web changed)
rebuild-web:
	npm run build:web


# Clean Tauri build artifacts
tauri-clean:
	cd desktop/src-tauri && cargo clean

# Reset all local Fosforescent data (local .fos, ~/.fos, caches, IndexedDB)
reset-local:
	@echo "🧹 Resetting all local Fosforescent data..."
	@rm -rf .fos 2>/dev/null || true
	@rm -rf ~/.fos 2>/dev/null || true
	@rm -rf ~/.cache/com.fosforescent.app 2>/dev/null || true
	@rm -rf ~/.local/share/com.fosforescent.app 2>/dev/null || true
	@rm -rf ~/.config/com.fosforescent.app 2>/dev/null || true
	@rm -rf web/node_modules/.vite 2>/dev/null || true
	@rm -rf web/dist 2>/dev/null || true
	@echo "✅ Reset complete. Run 'make tauri-dev' to start fresh."
