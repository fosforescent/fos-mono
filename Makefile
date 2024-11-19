MAKE=make


build-backend:
	npm run build:backend

build-frontend:
	npm run build:frontend


run-dev:
	npm run start

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

	
check: 
	make format
	make test
	make build

publish: 
	npm publish --access public

reset:
	npx prisma db push --force-reset
	npx prisma generate
	npx prisma db seed

run-clean-backend:
	make reset
	npm run dev:backend

	
m ?= wip
push:
	make check
	git add .
	git commit -m "$(m)"
	git push

