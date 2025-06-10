MAKE=make

include ./../.env
export $(shell sed 's/=.*//' ./../.env)

build-backend:
	which node
	node --version
	npm run build:backend

build-frontend:
	npm run build:frontend


run-dev:
	npm run dev

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
export

# Start backend with proper environment
backend:
	docker compose --profile backend up

# Start backend in background
backend-up:
	docker compose --profile backend up -d

# Start frontend
frontend:
	docker compose --profile frontend up

# Start frontend in background
frontend-up:
	docker compose --profile frontend up -d

# Start both backend and frontend for e2e testing
e2e-up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Restart backend
restart:
	docker compose --profile backend restart

# Show logs
logs:
	docker compose logs -f backend

# Show frontend logs
logs-frontend:
	docker compose logs -f frontend

# Show all logs
logs-all:
	docker compose logs -f

# Clean restart
clean-restart: down backend

# Full e2e environment
e2e-env: e2e-up
	@echo "Waiting for services to be ready..."
	sleep 30
	@echo "Backend: http://localhost:4000"
	@echo "Frontend: http://localhost:5173"