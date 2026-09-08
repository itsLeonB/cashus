# Agents

## Verification

After making code changes, verify the implementation using:

```bash
make lint
make build-all
make test
```

Do not use `go build` or `go test` directly.

## OpenAPI document

`backend/openapi.json` is a checked-in, generated artifact: the Huma-produced
OpenAPI document for the whole `/api/v1` + `/admin/v1` surface, serialized
without starting an HTTP server, a database, or any network connection. It's
the stable input the frontend's codegen step reads from.

```bash
make openapi        # regenerate openapi.json from the current router wiring
make openapi-check  # verify openapi.json matches the current router wiring (exits non-zero on drift; run in CI)
```

Both drive `cmd/openapi`, which wires up the same zero-value-provider gin
router + Huma API that `internal/adapters/http/routes.BuildNoopAPI` builds
for `TestFullRegistrationSmoke` (see `internal/adapters/http/routes/noop.go`
and `smoke_registration_test.go`), then marshals `api.OpenAPI()` as indented
JSON. Since `huma.Register` only inspects each Input/Output struct's shape
to build the spec, zero-value services are enough to produce the real,
complete document.

Whenever a route, handler Input/Output struct, or DTO shape changes, run
`make openapi` and commit the result. `make openapi-check` catches a missed
regeneration by diffing a fresh run against the checked-in file (not
`git diff`, so it behaves the same in CI and in a dirty local tree).

## Project Structure

```text
cmd/
  http/       → HTTP server entrypoint
  worker/     → Background worker entrypoint
  job/        → One-off jobs (migrations, asset sync)
internal/
  appconstant/   → Application-wide constants and enums
  core/          → Framework/infra layer (config, logger, otel, services like cache/mail/queue)
  domain/
    dto/         → Request/response data transfer objects
    entity/      → Domain entities (DB models via go-crud)
    mapper/      → Entity ↔ DTO conversion functions
    message/     → Async message structs (for worker subscribers)
    repository/  → Repository interfaces
    service/     → Business logic (service interfaces + implementations)
  adapters/
    http/        → HTTP server, routes, handlers, middlewares
    repository/  → Repository implementations (GORM)
    core/        → Infrastructure service implementations
    db/          → Database setup (postgres)
    worker/      → Worker subscribers and schedulers
    job/         → Job implementations
  provider/      → Dependency injection / wiring
```

## Conventions

### Architecture

- Clean Architecture: domain layer has no dependency on adapters or framework.
- Service interfaces are defined in `internal/domain/service/services.go`.
- Repository interfaces are defined in `internal/domain/repository/`.
- All wiring happens in `internal/provider/` — constructors use plain dependency injection (no DI container).

### Naming

- Service implementations: `<name>ServiceImpl` struct, `New<Name>Service` constructor.
- Handlers: `<Name>Handler` struct with a `Routes() []endpoint.Registrable` method; each route's Input→Request mapping and service call lives in a private lowerCamelCase method named after its OperationID (e.g. `createDebt`), passed as the route's `HandlerFunc` field.
- DTOs: `<Action>Request` / `<Action>Response` in the `dto` package.
- Mappers: standalone functions in `mapper/`, named `<Entity>To<DTO>` or `<DTO>To<Entity>`.

### Error Handling

- Use `github.com/itsLeonB/ungerr` for typed errors (`UnauthorizedError`, `NotFoundError`, `Unknown`, `Wrap`).
- Never return raw `errors.New()` from domain services — always use `ungerr`.

### Testing

- Tests use `testify/assert`.
- Test files use same package (e.g., `package middlewares`) with `_test.go` file suffix.
- Use `github.com/vektra/mockery` for generating mocks.

### Dependencies (key libraries)

- HTTP framework: `gin-gonic/gin`
- ORM: `github.com/itsLeonB/go-crud` (wraps GORM with `BaseEntity`, `Transactor`)
- JWT: `github.com/itsLeonB/sekure`
- Validation: gin's `binding` tags on DTOs
- Decimal: `github.com/shopspring/decimal`
- UUID: `github.com/google/uuid`
- Config: `github.com/kelseyhightower/envconfig` (via `split_words` / `default` struct tags)
- Observability: OpenTelemetry (`internal/core/otel`)

### Configuration

- All config is loaded from environment variables (struct tags in `internal/core/config/`).
- `.env` is auto-loaded via `github.com/joho/godotenv/autoload`.
- See `.env.example` for required variables.

### Adding a New Feature

1. Define or extend the service interface in `services.go`.
2. Implement in `internal/domain/service/`.
3. Add DTOs in `dto/`, mappers in `mapper/` if needed.
4. Add handler in `internal/adapters/http/handler/`.
5. Register route in `internal/adapters/http/routes/`.
6. Wire dependencies in `internal/provider/service_provider.go`.
