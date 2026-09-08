.PHONY: help \
http \
http-hot \
worker \
worker-hot \
job \
wire \
lint \
vulncheck \
test \
test-verbose \
test-coverage \
test-coverage-html \
test-clean \
build \
build-all \
openapi \
openapi-check

help:
	@echo "Makefile commands:"
	@echo "  make http                    - Start the HTTP server"
	@echo "  make http-hot                - Start the HTTP server with hot reload (requires air)"
	@echo "  make worker                  - Start the worker"
	@echo "  make worker-hot              - Start the worker with hot reload (requires air)"
	@echo "  make job                     - Run migrations + asset sync (production)"
	@echo "  make wire                    - Regenerate internal/provider/wire_gen.go"
	@echo "  make lint                    - Run golangci-lint on the codebase"
	@echo "  make vulncheck               - Run govulncheck for known vulnerabilities"
	@echo "  make test                    - Run all tests"
	@echo "  make test-verbose            - Run all tests with verbose output"
	@echo "  make test-coverage           - Run all tests with coverage report"
	@echo "  make test-coverage-html      - Run all tests and generate HTML coverage report"
	@echo "  make test-clean              - Clean test cache and run tests"
	@echo "  make build                   - Build HTTP server for production"
	@echo "  make build-all               - Build all programs for production"
	@echo "  make openapi                 - Regenerate openapi.json from the Huma router wiring"
	@echo "  make openapi-check           - Verify openapi.json matches the current router wiring"

http:
	go run ./cmd/http

http-hot:
	air --build.cmd "go build -o bin/http ./cmd/http" --build.bin "./bin/http"

worker:
	go run ./cmd/worker

worker-hot:
	air --build.cmd "go build -o bin/worker ./cmd/worker" --build.bin "./bin/worker"

job:
	go run -tags job ./cmd/job

wire:
	go generate ./internal/provider/...

lint:
	go vet ./...
	golangci-lint run ./...

vulncheck:
	go run golang.org/x/vuln/cmd/govulncheck@v1.7.0 ./...

test:
	@echo "Running all tests..."
	go test -race ./internal/...; \

test-verbose:
	@echo "Running all tests with verbose output..."
	go test -race -v ./internal/...; \

test-coverage:
	@echo "Running all tests with coverage report..."
	go test -race -v -coverprofile=coverage.out -covermode=atomic ./internal/...; \

test-coverage-html:
	@echo "Running all tests and generating HTML coverage report..."
	go test -race -v -coverprofile=coverage.out -covermode=atomic ./internal/... && \
	go tool cover -html=coverage.out -o coverage.html && \
	echo "Coverage report generated: coverage.html"; \

test-clean:
	@echo "Cleaning test cache and running tests..."
	go clean -testcache && go test -race -v ./internal/...; \

build:
	@echo "Building HTTP server..."
	CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false -ldflags='-w -s' -o bin/http ./cmd/http
	@echo "Build success! Binary is located at bin/http"

build-all:
	@echo "Building all programs..."
	@mkdir -p bin
	CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false -ldflags='-w -s' -o bin/http ./cmd/http
	CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false -ldflags='-w -s' -o bin/worker ./cmd/worker
	CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false -ldflags='-w -s' -tags job -o bin/job ./cmd/job
	@echo "Build success! Binaries are located in bin/"
	@ls -lh bin/

# openapi regenerates openapi.json by exercising the same no-op-provider
# Huma router wiring as TestFullRegistrationSmoke (see
# internal/adapters/http/routes.BuildNoopAPI) - no running server, no DB, no
# network. This is the stable input the frontend's codegen step consumes
# (CASH-18); commit the result whenever a route or DTO shape changes.
openapi:
	@echo "Generating openapi.json..."
	go run ./cmd/openapi > openapi.json
	@echo "openapi.json written"

# openapi-check regenerates the document to a temp file and diffs it against
# the checked-in openapi.json, so a route/DTO change that wasn't followed by
# `make openapi` fails CI instead of silently going stale. Deliberately not
# `git diff`-based: comparing generated output to the checked-in file works
# identically in CI and in a dirty local working tree.
openapi-check:
	@echo "Checking openapi.json is up to date..."
	@tmpfile=$$(mktemp) && \
	go run ./cmd/openapi > "$$tmpfile" && \
	diffout=$$(diff -u openapi.json "$$tmpfile"); \
	status=$$?; \
	rm -f "$$tmpfile"; \
	if [ $$status -eq 0 ]; then \
		echo "openapi.json is up to date."; \
	else \
		echo ""; \
		echo "openapi.json is out of date (checked-in vs regenerated):"; \
		echo "$$diffout"; \
		echo ""; \
		echo "Run 'make openapi' and commit the result."; \
		exit 1; \
	fi
