.PHONY: help \
lint lint-backend lint-frontend \
test test-backend test-frontend \
vulncheck vulncheck-backend \
build-all build-all-backend build-frontend \
openapi openapi-backend openapi-frontend \
openapi-check openapi-check-backend openapi-check-frontend \
install-pre-push-hook uninstall-pre-push-hook \
install-language-servers

help:
	@echo "Makefile commands:"
	@echo "  make lint                    - Lint backend + frontend"
	@echo "  make test                    - Test backend + frontend"
	@echo "  make vulncheck               - Run backend govulncheck (no frontend equivalent)"
	@echo "  make build-all               - Build backend binaries + frontend bundle"
	@echo "  make openapi                 - Regenerate backend/openapi.json and the frontend types generated from it"
	@echo "  make openapi-check           - Fail if either generated artifact is stale (CASH-17 drift check)"
	@echo "  make install-pre-push-hook   - Install root git pre-push hook"
	@echo "  make uninstall-pre-push-hook - Remove root git pre-push hook"
	@echo "  make install-language-servers - Install Go + TypeScript language servers (for Serena MCP)"

lint: lint-backend lint-frontend

lint-backend:
	$(MAKE) -C backend lint

lint-frontend:
	cd frontend && bun lint

test: test-backend test-frontend

test-backend:
	$(MAKE) -C backend test

test-frontend:
	cd frontend && bun test

vulncheck: vulncheck-backend

vulncheck-backend:
	$(MAKE) -C backend vulncheck

build-all: build-all-backend build-frontend

build-all-backend:
	$(MAKE) -C backend build-all

build-frontend:
	cd frontend && bun run build

# openapi-frontend regenerates from backend/openapi.json, so it must run
# after openapi-backend has (re)written that file.
openapi: openapi-backend openapi-frontend

openapi-backend:
	$(MAKE) -C backend openapi

openapi-frontend:
	cd frontend && bun run codegen:api

openapi-check: openapi-check-backend openapi-check-frontend

openapi-check-backend:
	$(MAKE) -C backend openapi-check

openapi-check-frontend:
	cd frontend && bun run codegen:api:check

install-pre-push-hook:
	@mkdir -p .git/hooks
	@cp scripts/git-pre-push.sh .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "Pre-push hook installed successfully!"

uninstall-pre-push-hook:
	@rm -f .git/hooks/pre-push
	@echo "Pre-push hook uninstalled successfully!"

install-language-servers:
	@scripts/install-language-servers.sh
