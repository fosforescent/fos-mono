MAKE=make

include ../.env
export $(shell sed 's/=.*//' ./.env)


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

	
check: 
	make format
	make test
	make build

publish: 
	npm publish --access public

	
m ?= wip
push:
	make check
	git add .
	git commit -m "$(m)"
	git push

