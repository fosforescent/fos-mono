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
	docker compose --profile e2e up -d

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