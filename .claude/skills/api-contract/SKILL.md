---
name: api-contract
description: Use when a feature touches both frontend/ and backend/ in the cashus monorepo, before dispatching backend-agent and frontend-agent in parallel worktrees. Produces the shared API contract that gets pasted verbatim into both subagents' prompts, so they build against one source of truth instead of diverging.
---

Fill in every section below for the endpoint(s) the feature needs, then paste the completed contract verbatim into both the `backend-agent` and `frontend-agent` dispatch prompts. Do not let either subagent redesign it — a disagreement gets flagged back to the orchestrator (see `CLAUDE.md`'s Post-implementation review section), not silently resolved by one side.

## Every response is enveloped — don't design around a bare body

All success responses are wrapped by `ginkgo/pkg/server.Handler[T]` as `{"data": <T>, "pagination"?: {...}}`; all error responses are wrapped by ginkgo's error middleware as `{"errors": [{"code": string, "detail": any}]}`. This is automatic, verified against the actual `ginkgo` module (`github.com/itsLeonB/ginkgo`) and `frontend/src/lib/api/client.ts`:

- **Backend**: handlers return the bare `<Action>Response` DTO and an `error` — `server.Handler` wraps it in `data` for you. Never manually wrap a response in `gin.H{"data": ...}` yourself; that would double-wrap.
- **Frontend**: `apiClient`'s `request()`/`uploadFile()` already unwrap `data` (`"data" in data ? data.data : data`) and `parseErrorResponse` already reads `errors[0].detail`. API functions in `src/lib/api/` should type their return as the bare `<Action>Response` shape — don't unwrap `.data` again in an API function or hook, it's already done.

So every "Response body shape" below is the *inner* `T`, not the envelope.

## Per endpoint

- **Route + method**: e.g. `POST /api/v1/expenses/:id/items`
- **Request body shape**: field names, types, required/optional. Name it `<Action>Request` — matches `backend/CLAUDE.md`'s DTO naming (`internal/domain/dto`).
- **Response body shape**: same field-level detail. Name it `<Action>Response`.
- **Status codes**: success code, and every error case mapped to an `ungerr` type (`NotFoundError`, `UnauthorizedError`, `Unknown`, etc. — see `backend/CLAUDE.md` Error Handling) so `frontend-agent` knows what `ApiError` shapes to expect.
- **Auth**: does this route require the auth middleware? Any role/permission check?

## Backend side (for backend-agent)

- Handler: `<Name>Handler` struct, `Handle<Action>()` method returning `gin.HandlerFunc`, registered in `internal/adapters/http/routes/`.
- DTOs in `internal/domain/dto/`, mapper functions in `internal/domain/mapper/` if the DTO isn't a direct passthrough of an entity.

## Frontend side (for frontend-agent)

- Zod schema in `src/lib/validations/` mirroring the request shape.
- API function in `src/lib/api/` using the shared `apiClient`.
- Hook in `src/hooks/useApi.ts` — name it `use<Action>` consistent with the existing hooks there (e.g. `useCreateDraftExpense`, `useSyncParticipants`).
- Query key addition in `src/lib/queryKeys.ts` if this introduces a new cached resource.

## Verification note

Both subagents should treat this contract as fixed input, not something to explore or infer from partially-written code on the other side — they're working in separate worktrees and can't see each other's changes until the orchestrator integrates both.
