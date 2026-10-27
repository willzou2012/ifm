.PHONY: help analyse syntax-check build build-cdn build-all clean test test-unit test-integration test-security frontend frontend-deps frontend-lint frontend-test test-e2e

PHP ?= php
NPM ?= npm
PHPSTAN ?= ./vendor/bin/phpstan
PHPUNIT ?= ./vendor/bin/phpunit
PHP_FILES := $(shell git ls-files '*.php')
FRONTEND := frontend

help:
	@echo "Available targets:"
	@echo "  make analyse      - run PHPStan static analysis on ./src"
	@echo "  make syntax-check - run PHP syntax checks for tracked PHP files"
	@echo "  make test         - build dist and run the full PHPUnit suite"
	@echo "  make test-unit    - run the unit test suite"
	@echo "  make test-integration - run the HTTP integration suite"
	@echo "  make test-security    - run the security/jail-escape suite"
	@echo "  make frontend     - build the Vue frontend (frontend/dist)"
	@echo "  make frontend-lint    - lint, format-check and type-check the frontend"
	@echo "  make frontend-test    - run the frontend unit tests with coverage"
	@echo "  make test-e2e     - build dist and run the browser end-to-end tests"
	@echo "  make build        - compile regular dist files"
	@echo "  make build-cdn    - compile CDN dist files"
	@echo "  make build-all    - compile regular and CDN dist files"
	@echo "  make clean        - remove dist directories"

analyse:
	@test -x $(PHPSTAN) || { echo "phpstan not found at $(PHPSTAN). Run: composer install"; exit 1; }
	$(PHPSTAN) analyse --memory-limit=512M

syntax-check:
	@set -e; \
	for file in $(PHP_FILES); do \
		$(PHP) -l "$$file" >/dev/null; \
		echo "OK $$file"; \
	done

test: build
	@test -x $(PHPUNIT) || { echo "phpunit not found at $(PHPUNIT). Run: composer install"; exit 1; }
	$(PHPUNIT)

test-unit: build
	$(PHPUNIT) --testsuite unit

test-integration: build
	$(PHPUNIT) --testsuite integration

test-security: build
	$(PHPUNIT) --testsuite security

$(FRONTEND)/node_modules: $(FRONTEND)/package.json $(FRONTEND)/package-lock.json
	cd $(FRONTEND) && $(NPM) ci
	@touch $@

frontend-deps: $(FRONTEND)/node_modules

frontend: frontend-deps
	cd $(FRONTEND) && $(NPM) run build

frontend-lint: frontend-deps
	cd $(FRONTEND) && $(NPM) run lint && $(NPM) run format:check && $(NPM) run type-check

frontend-test: frontend-deps
	cd $(FRONTEND) && $(NPM) run test:coverage

test-e2e: build
	cd $(FRONTEND) && PHP=$(PHP) $(NPM) run test:e2e

build: frontend
	$(PHP) ./compiler.php

build-cdn: frontend
	$(PHP) ./compiler.php --cdn

build-all: build build-cdn

clean:
	rm -rf dist $(FRONTEND)/dist
