MAKE=make

include ./../.env
export $(shell sed 's/=.*//' ./../.env)

FRONTEND_PORT := 5173

build-backend:
	which node
	node --version
	cd .. && npm run build:backend

build-frontend:
	cd .. && npm run build:frontend

# Build temporal worker container
build-temporal-worker:
	bash -c 'set -a && source ../.env && set +a && docker compose build temporal-worker'

# Build temporal worker with no cache
build-temporal-worker-clean:
	bash -c 'set -a && source ../.env && set +a && docker compose build temporal-worker --no-cache'

# Restart temporal worker
restart-temporal-worker:
	bash -c 'set -a && source ../.env && set +a && docker compose restart temporal-worker'

# Show temporal worker logs
logs-temporal-worker:
	docker compose logs -f temporal-worker

run-dev:
	cd .. && npm run dev

run:
	$(MAKE) run-dev
	
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

e2e-test:
	@echo "Running Playwright e2e tests via docker-compose smoke profile..."
	docker compose down || true
	docker compose up --build --abort-on-container-exit --exit-code-from smoke-test smoke-test; \
	TEST_EXIT_CODE=$$?; \
	docker compose down || true; \
	exit $$TEST_EXIT_CODE

	
check: 
	make format
	make test
	make build

publish: 
	npm publish --access public

prepare-db:
	echo "CREATE EXTENSION IF NOT EXISTS vector;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin

# Initialize database with migrations (safe for existing DBs)
db-init:
	@echo "Running Prisma migrations..."
	cd .. && npx prisma migrate deploy --schema=./prisma/schema.prisma

reset:
	echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin
	echo "CREATE EXTENSION IF NOT EXISTS vector;" | npx prisma db execute --schema=./prisma/schema.prisma --stdin 
	npx prisma db push --schema=./prisma/schema.prisma
	npx prisma generate --schema=./prisma/schema.prisma
	npx prisma db seed --schema=./prisma/schema.prisma

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


.PHONY: up down restart logs backend frontend e2e

# Load environment variables from parent .env file
include ../.env
export $(shell sed 's/=.*//' ../.env)


# Start backend with proper environment
all-up:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full up'

# Start all services with smoke test
all-up-with-smoke:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full-with-smoke up'

# Build and run with smoke test (full rebuild)
all-up-build-smoke:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full-with-smoke build'
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full-with-smoke up'

all-up-build-nocache:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full build --no-cache '
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full up'

all-up-build:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full up --build '

# Start backend with proper environment
all-down:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile full down'


# Start backend with proper environment
backend:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile backend up'

# Start backend in background
backend-up:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile backend up --remove-orphans -d'

# Start frontend
frontend:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile frontend up'

# Start frontend in background
frontend-up:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile frontend up -d'

# Start both backend and frontend for e2e testing
e2e-up:
	bash -c 'set -a && source ../.env && set +a && docker compose up -d'

# Stop all services
down:
	set -a && . ../.env && set +a && docker compose down --remove-orphans
	docker ps

# Restart backend
restart:
	bash -c 'set -a && source ../.env && set +a && docker compose --profile backend restart'

# Show logs
logs:
	docker compose logs -f backend

# Show frontend logs
logs-frontend:
	docker compose logs -f frontend

# Show all logs
logs-all:
	docker compose logs -f

# Show all logs
logs-show:
	docker compose logs


# Clean restart
clean-restart: down backend

# Full e2e environment
e2e-env: e2e-up
	@echo "Waiting for services to be ready..."
	sleep 30
	@echo "Backend: http://localhost:4000"
	@echo "Frontend: http://localhost:5173"
