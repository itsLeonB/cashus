# AGENTS.md

## Project Overview

Cashus is a modern expense-splitting and debt-tracking web application. This repository (`cashus-redesign`) is the **frontend SPA**.

## Tech Stack

- **Runtime/Package Manager**: Bun
- **Framework**: React 19 + Vite 7
- **Language**: TypeScript (strict null checks off)
- **Styling**: Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **State/Data**: TanStack Query (React Query) v5
- **Routing**: React Router v6
- **Validation**: Zod v4
- **Linting**: oxlint (typescript, react, unicorn, oxc plugins)
- **Deployment**: Vercel

## Commands

- `bun dev` — dev server
- `bun build` — production build
- `bun lint` — lint

## Project Structure

```
src/
├── config/config.ts    # Single source for all environment variables
├── components/         # Reusable components
│   └── ui/             # shadcn/ui primitives
├── contexts/           # React context providers (AuthContext)
├── hooks/              # Custom hooks (useApi.ts is the main data layer)
├── layouts/            # Page layout shells
├── lib/
│   ├── api/            # API client, endpoint functions, types
│   ├── validations/    # Zod schemas
│   ├── flags.ts        # Feature flags
│   ├── constants.ts    # App-wide constants
│   └── queryKeys.ts    # TanStack Query key registry
├── pages/              # Route-level page components
│   ├── auth/           # Login, register, forgot/reset password
│   └── landing/        # Marketing/landing pages
└── utils/              # Pure utility functions
```

## Conventions

### Environment Variables

All `import.meta.env` access MUST go through `src/config/config.ts`. No other file should reference `import.meta.env` directly. Consumers import the config object:

```ts
import config from "@/config/config";
```

### Imports

- Use `@/` path alias (maps to `src/`).
- Use named imports from `react` — never `import * as React` (convention; not currently lint-enforced — oxlint's `import/no-namespace` can't be scoped to just `react` and would false-positive on shadcn's `import * as XPrimitive from "@radix-ui/..."`).
- Group: external packages → `@/` internal → relative.

### Components

- Pages are default-exported from `src/pages/`.
- Reusable UI uses shadcn/ui conventions (`components/ui/`).
- Props should be read-only (convention; not currently lint-enforced — oxlint has no `sonarjs/prefer-read-only-props` equivalent).

### Data Fetching

- All API functions live in `src/lib/api/` and use the shared `apiClient` from `client.ts`.
- Hooks wrapping queries/mutations live in `src/hooks/useApi.ts`.
- Query keys are centralized in `src/lib/queryKeys.ts`.

### Styling

- Tailwind utility classes. No CSS modules.
- CSS variables for theming (defined in `src/index.css`).
- `class-variance-authority` for component variants.
- `tailwind-merge` + `clsx` via the `cn()` helper in `src/lib/utils.ts`.

### Error Handling

- API errors are typed as `ApiError` (from `src/lib/api/types`).
- Mutations use `onError` callbacks with toast notifications.

### Forms

- Controlled components with `useState`.
- Zod schemas in `src/lib/validations/` for complex validation.
- Native HTML validation attributes (`required`, `type="email"`) for simple cases.

### Feature Flags

- Flagsmith for runtime flags.
- Build-time flags via `src/lib/flags.ts` (reads from config).

### API codegen (CASH-19)

`src/lib/api/schema.gen.ts` holds TypeScript types generated from the backend's
OpenAPI document (`../backend/openapi.json`, repo-root-relative) by
[`openapi-typescript`](https://openapi-ts.dev), via `scripts/codegen-api.ts`.
This is the mechanism that keeps frontend request/response types from
drifting out of sync with the backend (see CASH-13, the drift bug CASH-19
exists to prevent).

- `bun run codegen:api` — regenerates `src/lib/api/schema.gen.ts` from
  `../backend/openapi.json`.
- `bun run codegen:api:check` — regenerates to a temp file and compares its
  contents against the checked-in `schema.gen.ts`, exiting non-zero on a
  mismatch. Deliberately does **not** use `git diff` (that would behave
  differently in CI vs. a dirty local working tree) — it's a pure
  file-content comparison against freshly generated output, so it works the
  same everywhere. Run this in CI (or before committing a backend contract
  change) to catch stale generated types.
- Both scripts accept `--input=<path>` / `--output=<path>` overrides (used
  by `scripts/codegen-api.test.ts` to test against
  `scripts/__fixtures__/openapi.sample.json` instead of the real backend
  document); they default to `../backend/openapi.json` and
  `src/lib/api/schema.gen.ts`. Generation reads the input file into memory
  and parses it itself before handing it to `openapi-typescript` — it never
  fetches over HTTP, so it works with no network and never talks to a
  running backend.

**`src/lib/api/types.ts`**: types for endpoints the OpenAPI schema covers are
re-exported from `schema.gen.ts` (`export type X = components["schemas"]["X"]`)
rather than callers importing from `schema.gen.ts` directly — this keeps
`from "./types"` a stable import path for every existing call site regardless
of which side (hand-written vs. generated) a given type currently comes from.
Types the schema doesn't cover, or that are frontend-only/client-composed
(e.g. `ApiError`, assembled from a parsed error response plus
frontend-added fields), stay hand-written in the same file.

**Provenance note**: `schema.gen.ts` is generated from the real
`backend/openapi.json` — `bun run codegen:api:check` confirms it's
byte-identical to fresh output from that document, and it carries no
`⚠️ Generated from ...` banner (that banner only appears when generation
runs against a non-default `--input`). The auth/profile re-exports in
`types.ts` use the real schema component names
(`LoginAuthInputBody`, `RegisterAuthInputBody`, `ResetPasswordInputBody`,
`ProfileResponse`, `SubscriptionLimitsResponse`, `UploadLimit`).

Historical note: CASH-19 was built and initially validated in an isolated
worktree before `backend/openapi.json` existed (CASH-18 was landing in
parallel), so `schema.gen.ts` and the `types.ts` re-exports were first
generated against `scripts/__fixtures__/openapi.sample.json` — a small,
hand-written fixture mirroring that slice of the contract — to prove the
pipeline correct ahead of time. That fixture-derived output was replaced by
a real regeneration once both sub-tasks merged; the fixture and its test
(`scripts/codegen-api.test.ts`) remain as the pipeline's test coverage, not
as the source of the checked-in `schema.gen.ts`.

Friendships, debts, and expenses are not yet re-exported from
`schema.gen.ts` — those interfaces in `types.ts` stay hand-written for now.
That's a deliberate CASH-19 scope boundary (auth + profile only), not an
oversight; extending the re-exports to those endpoints is follow-up work.

Zod validators in `src/lib/validations/` are still fully hand-written.
Hey API's Zod plugin (the suggested stretch goal) was not wired in: the
existing schemas there (`transaction.ts`, `profile.ts`) are form-level
validators with business-rule refinements (future-date rejection,
calendar-validity checks) that don't correspond 1:1 to any wire schema, so
generating parallel schemas wouldn't have replaced anything without
duplicating logic. Revisit if/when a shape worth validating at the wire
boundary shows up that doesn't carry that kind of business-rule logic.
