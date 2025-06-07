MAKE=make

include ./.env
export $(shell sed 's/=.*//' ./.env)

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
	@echo "Starting servers and running e2e tests..."
	npm run dev 2>&1 | tee server.log &
	@echo "Waiting for servers to start..."
	sleep 10
	@echo "Running Playwright tests..."
	npx playwright test; \
	TEST_EXIT_CODE=$$?; \
	echo "Stopping servers..."; \
	pkill -f "npm run dev" || true; \
	exit $$TEST_EXIT_CODE

	
check: 
	make format
	make test
	make build

publish: 
	npm publish --access public

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
