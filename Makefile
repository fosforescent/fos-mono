MAKE=make

include ./.env
export $(shell sed 's/=.*//' ./.env)

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
	@echo "Setting up e2e tests with hybrid docker-compose + local frontend..."
	cd infra && docker compose down || true
	pkill -f "npm run dev:frontend" || true
	@echo "Starting backend with docker-compose..."
	cd infra && make backend-up
	@echo "Waiting for backend to be ready..."
	sleep 30
	@echo "Starting frontend locally..."
	npm run dev:frontend > frontend.log 2>&1 &
	@echo "Waiting for frontend to start..."
	sleep 15
	@echo "Running Playwright tests..."
	cd e2e && npx playwright test --headed; \
	TEST_EXIT_CODE=$$?; \
	echo "Stopping servers..."; \
	pkill -f "npm run dev:frontend" || true; \
	cd infra && docker compose down || true; \
	pkill -f "tsx.*backend" || true; \
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
