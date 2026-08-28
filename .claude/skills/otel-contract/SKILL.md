---
name: otel-contract
description: Background knowledge on this repo's actual OpenTelemetry conventions, for backend-agent and frontend-agent to stay consistent when instrumenting new code. Not a workflow to run — just the established pattern.
user-invocable: false
---

## Backend (`backend/internal/core/otel/otel.go`)

- One package-level `otel.Tracer`, scope name = the Go module path (`github.com/itsLeonB/cashback`), initialized once in `InitSDK` and gated entirely by `cfg.Enabled` (`OTEL_ENABLED` env var) — when disabled, `Tracer` is a no-op tracer, so instrumented code is always safe to call.
- Manual spans follow one naming pattern throughout the codebase: `otel.Tracer.Start(ctx, "<ReceiverType>.<MethodName>")` — the receiver's type name (not a description), dot, the method name. Examples already in the codebase: `"openAILLMService.Prompt"`, `"gcsStorageRepository.Upload"`, `"natsClient.Enqueue"`, `"OtherFeeRepository.SyncParticipants"`.
- Spans are added at adapter/service boundaries that do real I/O (external API calls, storage, queue, DB repository methods) — not on every function. Follow the existing density: if a sibling method in the same file has a span, a new method doing the same kind of I/O should too; pure in-memory logic doesn't get one.
- Always `ctx, span := otel.Tracer.Start(ctx, "...")` then `defer span.End()`, propagating the returned `ctx` onward — never the original.

## Frontend (`frontend/src/lib/faro.ts`)

- Tracing is fully automatic via Grafana Faro (`@grafana/faro-react` + `@grafana/faro-web-tracing`), initialized once at app startup: `getWebInstrumentations()` (core web vitals, errors, console) + `TracingInstrumentation()` (auto-traces fetch/XHR) + `ReactIntegration` (React Router v6 navigation spans).
- There is no manual span-creation API used anywhere else in the frontend — don't add one. New API calls and route changes are captured automatically by the existing instrumentation; nothing extra is needed in `src/lib/api/` or `src/hooks/useApi.ts` for them to show up in traces.
- Only touch `frontend/src/lib/faro.ts` itself if the tracing/instrumentation configuration is literally what's being changed.
