.PHONY: up down restart logs backend

# Load environment variables from parent .env file
include ../.env
export

# Start backend with proper environment
backend:
	docker compose --profile backend up

# Start backend in background
backend-up:
	docker compose --profile backend up -d

# Stop all services
down:
	docker compose down

# Restart backend
restart:
	docker compose --profile backend restart

# Show logs
logs:
	docker compose logs -f backend

# Clean restart
clean-restart: down backend