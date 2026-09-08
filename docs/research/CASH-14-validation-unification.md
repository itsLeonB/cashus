# CASH-14: Unifying frontend/backend validation rules — spike findings

**Ticket:** CASH-14 (Spike, 2-day timebox)
**Question:** Business-rule validation currently lives independently in `backend/` (Go) and `frontend/` (TS), and can drift out of sync. CASH-13 showed the same drift already happened once, at the *error-response contract* level (frontend read fields the backend never sent). This spike surveys proven approaches to unify or sync *validation rules* between the two layers and recommends a direction for Cashus specifically.
**No code changes were made for this spike.** This document is research output only.

---

## 1. Cashus's current validation setup

### Backend (Go / Gin / GORM / Huma)

`backend/CLAUDE.md` states "Validation: gin's binding tags on DTOs" — **this is stale**. Reading the actual code shows the backend finished migrating its entire HTTP surface from gin's native binding/`ShouldBindJSON` to **Huma v2** (an OpenAPI-3.1-first framework), confirmed by the migration commit series (`30757ce` "introduce Huma v2 wiring... migrate debts handler (canary)" through `0a2f91e` "migrate admin endpoints to Huma" and `e30f709` "migrate auth to huma"). A repo-wide grep for `ShouldBindJSON`/`ShouldBind(`/`c.Bind(` returns **zero** non-test hits — gin's own validator is no longer invoked anywhere.

Concretely, validation today happens at two independent layers on the backend itself:

1. **Structural/shape validation — Huma, via struct tags on each handler's own `Input` type.** E.g. `backend/internal/adapters/http/handler/debt_handler.go`'s `CreateDebtInput.Body` uses Huma-native tags (`enum:"INCOMING,OUTGOING"`, `minLength:"3"`, `maxLength:"3"`), not gin's `binding:"..."`. Huma turns these into a JSON Schema and generates a live OpenAPI 3.1 document, auto-mounted at `/openapi.json`/`/docs` (`backend/internal/adapters/http/huma/config.go`). This Input type is a **separate, hand-written struct** from the `dto.NewDebtTransactionRequest` DTO used internally — the handler manually copies fields from one to the other (`debt_handler.go:72-84`).
2. **Business-rule validation — imperative Go in the service layer, using `ungerr`.** E.g. `backend/internal/domain/service/debt_service.go:64-65`: `if !req.Amount.IsPositive() { return ..., ungerr.ValidationError("amount must be greater than 0") }`, and `backend/internal/domain/service/expense_item_service.go:44,63`: `if req.Amount.IsZero() { return ungerr.UnprocessableEntityError(appconstant.ErrAmountZero) }`. **This rule is not expressed anywhere in the Huma/OpenAPI schema** — the `Amount` fields in the Input structs carry no `minimum`/`exclusiveMinimum` tag, only `required:"true"` (see `expense_item_handler.go:31-32`, `other_fee_handler.go:32`). The "amount must be > 0" rule the ticket cites as its running example is, right now, 100% backend-service-layer-only and invisible to any schema/OpenAPI consumer.

Errors from both layers surface through the same contract: `ungerr.AppError` (`github.com/itsLeonB/ungerr`) implements `huma.StatusError` directly — proven by a dedicated backend test, `backend/internal/adapters/http/huma/status_error_test.go` (`TestUngerrSatisfiesHumaStatusError`, `TestUngerrErrorProducesRealHTTPStatus`) — so no adapter is needed for either layer's errors to reach the wire with the right HTTP status. Field-level Huma validation failures and manual resolver errors (e.g. password-confirmation mismatch, `backend/internal/adapters/http/huma/password.go`) both surface as Huma's own `ErrorDetail` array (`{location, message}`), which is the contract CASH-13 fixed the frontend to actually match (see `ValidationError`/`ApiError` below).

One backend DTO oddity worth flagging as its own small cleanup, independent of this spike: several `dto.*Request` structs (`backend/internal/domain/dto/debt_transaction_dto.go`, `expense_item_dto.go`, etc.) still carry gin `binding:"required"`/`binding:"oneof=..."`/`binding:"len=3"` tags. Since nothing calls gin's bind/validate anymore, **these tags are dead code** — a second, independent kind of validation-rule drift (decorative tags nobody enforces) sitting right next to the real one this spike is about.

### Frontend (React/Vite/TS)

`frontend/CLAUDE.md` accurately describes today's setup: **Zod v4** schemas under `frontend/src/lib/validations/` for "complex" cases, plus "native HTML validation attributes... for simple cases," plus ad hoc component-level checks. In practice, coverage is uneven:

- `frontend/src/lib/validations/transaction.ts` has a real, well-commented Zod schema (`transactionDateSchema`) for the transaction date, replicating backend date rules (must be a real calendar date, can't be in the future) entirely independently in hand-written TS.
- `frontend/src/lib/validations/profile.ts` has a small Zod schema for the profile-edit form only.
- **There is no Zod schema, and no equivalent check at all, for the amount-must-be-positive rule** the ticket names as its example. `frontend/src/components/ExpenseItemModal.tsx:58` and `frontend/src/components/TransactionModal.tsx:92` both gate submission only on `!amount` (falsy/empty-string check) — a `0` or negative amount typed into the field passes client-side and is only rejected after a round trip, by the backend service-layer check above. This is the drift the ticket is worried about, already live in production today, not hypothetical.
- `frontend/src/lib/api/types.ts` hand-declares every request/response shape (`NewDebtTransactionRequest`, `DebtTransactionResponse`, etc.) as plain TS interfaces with **no codegen** — every field is manually kept in sync with the corresponding Go DTO/Input struct by whoever writes the PR.
- `frontend/src/lib/api/types.ts:395-401` defines `ValidationError { message?, location?, value? }` with a comment explicitly noting it mirrors "Huma's ErrorDetail" — i.e. the frontend's error-shape fix (CASH-13's territory) is already hand-aligned to Huma's real contract, but by hand, with no structural guarantee it stays that way as the backend evolves.

### Existing decisions on record

- `docs/adr/0001-keep-duplicate-create-update-input-bodies.md`: the team explicitly chose to **keep** duplicated Create/Update Huma `Body` structs on the backend rather than extract a shared base type, on readability grounds ("less mental overhead than tracing a shared... type"). This is a live cultural signal: Cashus has already rejected one DRY-the-schema refactor on its own backend for readability reasons, which should weigh against recommending a heavy, all-in unification mechanism here too.
- No `CONTEXT.md` or other `docs/adr/` entries touch validation or the API contract directly.
- No existing `docs/research/` or `docs/spikes/` convention existed before this document — **this file is the first entry in a newly created `docs/research/` directory**, matching the sibling `docs/adr/`, `docs/agents/`, `docs/deployment/` layout.

---

## 2. Approaches investigated

### A. Backend-returns-validation-rules / BFF-style schema exposure

**Mechanism:** the backend exposes its validation rules as data (a schema/metadata endpoint, or embedded per-response), and the frontend reads that schema to drive its own validation UI instead of hand-duplicating rules in code.

**Evidence:** Huma — already Cashus's backend framework — has this built in for free today. Per Huma's own docs, every operation can carry a `describedby` `Link` header and/or an embedded `$schema` property pointing at a JSON Schema document Huma generates from the same struct tags used for validation (huma.rocks, "JSON Schema & Registry" feature page); Cashus's `httpapi.NewConfig` (`backend/internal/adapters/http/huma/config.go`) currently *disables* both (`cfg.CreateHooks = nil; cfg.SchemasPath = ""`) but leaves the full OpenAPI document mounted at `/openapi.json`/`/docs` — so the schema is already being generated and served, just not per-response-linked. Real-world BFF-style consumption of a backend-declared JSON Schema to drive a form's client validation is the entire premise of **react-jsonschema-form** (rjsf-team/react-jsonschema-form on GitHub), in production use since 2016 including at Mozilla's `kinto-admin` (per RJSF's own project docs/README).

**Pros:** single source of truth by construction — the same struct tags the backend already validates against are what the frontend would consume; zero new backend dependency (Huma already does this); re-enabling `CreateHooks`/`SchemasPath` is a config flip, not new plumbing.

**Cons:** RJSF-style consumption implies rendering forms *from* the schema (or at least driving a generic schema-validator like `ajv` from it), which is a bigger frontend shift than Cashus's current hand-built shadcn/ui forms — Cashus would more likely fetch the JSON Schema and feed it into a validator library at the edges of existing forms, which is more integration work than it sounds; and, per the earlier finding, today's actual business rule ("amount > 0") isn't even encoded in the Huma schema yet, so this only pays off once the backend team starts pushing more rules up into schema tags (`exclusiveMinimum`, etc.) instead of imperative service-layer checks — itself a meaningful backend refactor.

**Fit for Cashus:** Good long-term direction, poor immediate ROI — the payoff requires backend rule-authoring habits to change first (move simple constraints from service-layer `if` checks into Huma tags), which is a separate, larger piece of work than this spike's timebox.

### B. Dedicated validation endpoint (validate-without-persist)

**Mechanism:** the frontend calls a backend endpoint that runs the same validation/business-rule path as the real write endpoint, but returns before persisting — either a separate `POST /x/validate` route, or a `dryRun` flag/query param on the real route.

**Evidence:** the most rigorously documented, widely-relied-upon production instance of exactly this pattern is Kubernetes's API server `dryRun` query parameter (KEP-576, `kubernetes/enhancements`, and the official Kubernetes docs): "the request is still processed as a typical request: the fields are defaulted, the object is validated, it goes through the validation admission chain... and then the final object is returned to the user... without being persisted." Every admission webhook must explicitly declare its `dryRun` side-effect behavior (`None`/`NoneOnDryRun`) or requests are auto-rejected — i.e. the pattern is specified precisely enough that a webhook that isn't dry-run-safe can't silently corrupt the guarantee.

**Pros:** guarantees zero drift *at the moment of submission* — the frontend is literally invoking the same code path (service-layer checks included) that would run on real submission, so "amount > 0" and any future rule are covered without the frontend ever encoding the rule itself; requires no new frontend validation library or schema tooling.

**Cons:** round-trip latency on every validation check (worse UX than instant client-side feedback — Cashus's forms are simple single-page modals, not multi-step wizards, so instant feedback matters more here than in Kubernetes's control-plane context); doesn't eliminate the DTO-shape duplication in `frontend/src/lib/api/types.ts`, only the business-rule duplication; the Kubernetes precedent is a distributed-systems admission-control pattern, not a small-team CRUD-app one, and the side-effect-safety machinery it needed (explicit dry-run-awareness per webhook) has no Cashus equivalent to build against — Cashus would need to make every service method dry-run-aware itself (e.g. `debt_service.go`'s `RecordNewTransaction` would need a "check, don't write" mode), which is a real backend change per business rule, not a one-time framework switch.

**Fit for Cashus:** Reasonable as a *narrow, targeted* addition (e.g. one `validate` mode used only by the highest-value forms) but a poor fit as the primary/only mechanism — implementing "check, don't write" for every mutating service is a bigger and more error-prone lift than it looks, and the UX cost (a network round trip to know if `-5` is a bad amount) undercuts most of the benefit relative to a client-side rule.

### C. Shared schema via OpenAPI + codegen on both sides

**Mechanism:** treat the OpenAPI document Huma already generates as the single source of truth; run a TS generator against it in CI/build to produce the frontend's request/response types (and, optionally, runtime validators), replacing the hand-written interfaces in `frontend/src/lib/api/types.ts` and (where coverage allows) the hand-written Zod schemas in `frontend/src/lib/validations/`.

**Evidence:**
- **openapi-typescript** (`openapi-ts.dev`, `openapi-ts/openapi-typescript` on GitHub) generates TypeScript *types* (paths/operations/components) from a static OpenAPI 3.0/3.1 document with "zero runtime cost" — types only, no runtime validation.
- For *runtime* validators generated the same way, **openapi-zod-client** (astahmer/openapi-zod-client) generates a Zod-backed client from an OpenAPI/JSON spec, and the **Hey API** ecosystem's Zod plugin (`heyapi.dev`) generates Zod v4 schemas directly from an OpenAPI document as one of 20+ plugins in that toolchain; Hey API's own GitHub README states it is "used by Vercel, OpenCode, PayPal, AWS, Autodesk, and many more" (first-party adoption claim, `github.com/hey-api/hey-api`).
- On the Go side, Cashus needs *no new tool* here — Huma is already the code-first generator of the OpenAPI document (as opposed to `oapi-codegen`, which is the common **schema-first** alternative that generates Go server/client code *from* a hand-authored OpenAPI YAML — the opposite direction from what Huma does, and not needed here since Cashus is already code-first on the Go side).

**Pros:** the backend side of this is **already built and running in production** (Huma's OpenAPI generation) — this approach only requires *frontend* tooling and a CI check that regenerates types from `/openapi.json` and fails the build on drift; eliminates the hand-typed `frontend/src/lib/api/types.ts` duplication entirely for shape/structural rules (`required`, `enum`, `minLength`/`maxLength`, `format`) which is most of what's expressed in Huma tags today; strictly additive — no change to how the backend authors validation.

**Cons:** only as good as what the backend actually encodes in Huma tags — today's amount-positivity rule is *not* encoded there (service-layer only, see §1), so this approach's payoff for the ticket's own example rule is zero *until* the backend also starts moving simple numeric/string constraints into Huma tags (a backend-side habit change, not free); Cashus's `httpapi.Decimal` wrapper (`backend/internal/adapters/http/huma/schema.go`) implements `huma.SchemaProvider` with a fully custom `Schema()` that returns `AnyOf[number, string]` — whether Huma *merges* an added `exclusiveMinimum` struct tag onto that custom schema or the custom `Schema()` fully overrides it is not documented in Huma's public docs (checked `huma.rocks/features/model-validation/`) and would need to be verified against Huma's source/behavior before relying on it for the `amount` field specifically; adds a frontend build-time codegen step and a CI drift-check that doesn't exist today.

**Fit for Cashus:** **Best fit of the group.** It builds on infrastructure Cashus already paid for (the Huma migration), needs no new backend dependency, and directly targets the concrete failure mode CASH-13 already exposed (hand-typed frontend interfaces silently diverging from what the backend actually sends/expects). The open question about `Decimal`'s custom schema merging is exactly sized for a spike's follow-up: a half-day Go experiment, not a redesign.

### D. Single source-of-truth schema authored externally, codegen into both Go structs and TS (schema-first)

**Mechanism:** author validation-bearing shapes once in a hand-written JSON Schema/OpenAPI document (not derived from Go code), then generate *both* Go server types (e.g. via **oapi-codegen**, `oapi-codegen/oapi-codegen` on GitHub — "Generate Go client and server boilerplate from OpenAPI 3 specifications") and TS types/validators from that same document.

**Evidence:** oapi-codegen's own README describes exactly this workflow and is widely used for schema-first Go services.

**Pros:** true single source of truth with no "which side is authoritative" ambiguity; well-trodden tool for teams that want schema-first Go services from scratch.

**Cons:** **inverts Cashus's actual architecture.** The backend is deliberately code-first (Huma infers the schema from Go structs/tags, by design — see `httpapi` package doc comment in `backend/internal/adapters/http/huma/config.go`), and the team just finished a multi-commit migration to get there (`30757ce` → `89b0d3a`). Switching to schema-first would mean re-deriving Go types from a hand-written spec instead of the reverse — a second large migration, undoing real, recent work, for a monorepo-sized team (the ticket tracker itself, a single small YouTrack project, implies this isn't a large org). Also sits awkwardly next to ADR-0001, which already rejected one DRY-the-backend-schema refactor on readability grounds; a schema-first rewrite is a much bigger version of the same trade the team already declined.

**Fit for Cashus:** Poor. Solves the same problem as (C) but at a much higher migration cost, for a team this size, on a backend that already picked the opposite direction on purpose.

### E. Shared validation DSL / cross-language rule language

**Mechanism:** express business rules once in a language-agnostic DSL evaluated identically on both sides — e.g. JSON Schema's own keyword vocabulary (`minimum`/`exclusiveMinimum`/`pattern`/etc.) run through a validator library on each side (Go: e.g. `santhosh-tekuri/jsonschema` or similar; TS: `ajv`), or **CEL** (Common Expression Language), which Kubernetes uses for exactly this purpose in CRD validation rules (`x-kubernetes-validations`, official Kubernetes docs) and which has a Go reference implementation (`google/cel-go`, Google's own) and CEL implementations in other languages.

**Evidence:** Kubernetes's CEL-based CRD validation is a large-scale, well-documented production use of a shared cross-language validation DSL; JSON Schema itself (json-schema.org, the spec Huma already targets for its generated documents) is the more directly-applicable DSL here since Cashus is already emitting JSON-Schema-shaped output from Huma.

**Pros:** in principle the most rigorous fix — one rule definition, two conformant evaluators, provably identical semantics (for whatever subset of the DSL both validators support).

**Cons:** the ticket's own example rule ("amount must be more than 0") is a `minimum`/`exclusiveMinimum` JSON Schema keyword away from being expressible this way — but Cashus's *more interesting* rules already aren't simple keyword checks: the future-date rule in `frontend/src/lib/validations/transaction.ts` (calendar-validity + "not in the future, per server's UTC day") and the repayment-amount rule computed server-side from a *live net balance* (`debt_service.go` `RecordRepayment`) are cross-field/stateful/temporal — outside what JSON Schema keywords or CEL expressions can practically encode without a database read, so a real DSL layer would only ever cover the simpler subset of Cashus's rules, and the harder ones (arguably the ones most worth protecting from drift) would still need hand-written logic on both sides regardless. Introducing CEL specifically would also be a new runtime dependency and a new authoring language for a two-person-scale team, for a rule set that's mostly the "simple" kind JSON Schema (already in the stack via Huma) covers just as well.

**Fit for Cashus:** Weak relative to (C) — JSON Schema (already present via Huma) is the useful part of this idea, and CEL specifically adds a new tool/language for a marginal gain the team's rule set doesn't need.

### F. Contract testing (Pact)

**Mechanism:** the consumer (frontend) encodes its expectations of provider (backend) responses as executable interaction tests; Pact records these as a "contract" file, publishes it (typically via a Pact Broker), and CI verifies the real backend still satisfies every recorded interaction — catching contract drift without unifying the schema itself.

**Evidence:** Pact's own documentation (`docs.pact.io`) describes this consumer-driven workflow precisely: "the consumer writes a unit test of its behaviour using a Mock provided by Pact... Pact writes the interactions into a contract file... the consumer publishes the contract to a broker... Pact retrieves the contracts and replays the requests against a locally running provider." Pact has known first-party support for Go providers and JS/TS consumers.

**Pros:** doesn't require picking a winner between code-first and schema-first, or changing how either side authors validation today; directly catches the *kind* of drift CASH-13 was — a consumer asserting on a response shape the provider doesn't actually produce — which is squarely what Pact is built for; incremental, can be added test-by-test.

**Cons:** Pact contracts are typically about response *shape*/interaction, not a mechanism for *sharing* validation rules — it's a regression-detection net, not a unification mechanism, so it doesn't reduce the ongoing hand-duplication effort at all, only shortens the time-to-detect when it drifts; adds broker infrastructure (or file-based sharing) and a new test-authoring discipline (interaction-based tests distinct from Cashus's current `testify`-based Go tests and whatever the frontend's test setup is) for a monorepo where both sides already live in one repo and one CI run — much of Pact's value proposition (decoupled deploy cadences across separately-owned services) doesn't apply when frontend and backend already share a repo, a CI pipeline, and (presumably) a PR review process.

**Fit for Cashus:** Weak as a *primary* fix — it's solving a distributed-systems/separately-deployed-services problem Cashus doesn't quite have (monorepo, single CI). Worth keeping in mind only as a supplementary regression-catcher if CASH-13-style incidents recur after a schema-based fix (C) is in place, not as this spike's answer.

### G. Monorepo shared-package pattern (Go module + TS package sharing one schema)

**Mechanism:** publish the OpenAPI document (or a JSON Schema subset of it) as a versioned artifact inside the monorepo — e.g. a checked-in `schema/openapi.json` regenerated by a `make` target — that both `backend/` (as the source) and `frontend/` (as a codegen input) reference, with a CI step that fails if `frontend/`'s generated types are stale relative to the backend's current schema.

**Evidence:** this is the same class of pattern used by API-first orgs like GitHub and Stripe, both of which check an OpenAPI document into a public repo (`github/rest-api-description`, `stripe/openapi`) as the artifact multiple generated clients/SDKs are built from — Stripe's own `stripe/openapi` repo is exactly this "one committed spec, many generated consumers" shape, though Stripe's spec is itself hand/tool-authored rather than framework-derived the way Huma's is.

**Pros:** low ceremony for a monorepo specifically — no cross-repo versioning problem, no package registry needed, since `frontend/` and `backend/` already sit in one repo with one CI pipeline; naturally composes with (C): the "shared package" *is* the generated OpenAPI document plus the frontend codegen step that consumes it.

**Cons:** on its own this is just packaging/plumbing for approach (C), not a distinct mechanism — it doesn't answer whether the source of truth is code-first (Huma) or schema-first (hand-authored), it only answers *how the artifact moves between directories in one repo*, which for Cashus is close to trivial (a `make` target that curls `/openapi.json` from a locally-running backend, or better, generates it offline from the Go code via Huma's CLI/test helpers, then runs the frontend generator against the result).

**Fit for Cashus:** Not a competing option — it's the "how" that makes (C) concrete for this specific monorepo layout (`backend/`, `frontend/`, one root `Makefile` per `CLAUDE.md`), and should be folded into whatever implementation ticket follows from adopting (C).

---

## 3. Ranked recommendation

1. **C — Shared schema via OpenAPI + codegen (Huma → openapi-typescript/Hey API), packaged as in (G).** Best fit: builds entirely on infrastructure Cashus already has and paid the migration cost for (Huma's OpenAPI generation), needs zero new backend dependencies, directly targets the exact failure mode CASH-13 exposed (hand-typed frontend interfaces drifting from the real contract), and scales its own ambition to how much the backend team is willing to push structural rules into Huma tags — it can start by just fixing type-shape drift and grow into rule-sharing incrementally.
2. **B — Dedicated validate-without-persist mode, narrowly, for the highest-value forms only** (e.g. the debt/repayment amount check). Second because it's the only approach that would have caught the ticket's own example rule *today*, with no backend rule-authoring changes at all — but it's a poor primary mechanism (round-trip UX cost, per-service "check don't write" plumbing), so it belongs as a targeted supplement to (C), not a replacement for it.
3. **A — BFF-style schema exposure (re-enable Huma's `$schema`/`describedby` links).** Third: genuinely low-cost to turn on (a config flip) and a natural complement to (C), but by itself it only exposes what (C) would also expose via codegen, without the type-safety and build-time drift-detection (C) gets from generating actual TS code.
4. **F — Pact contract testing**, as a supplementary regression net once (C) exists, not as the primary fix — it detects drift after the fact rather than preventing it, and its core value (decoupled service deploys) doesn't fit a monorepo/single-CI setup as cleanly as it fits Pact's usual microservices context.
5. **E — Shared validation DSL (JSON Schema keywords beyond what Huma already emits, or CEL).** Low priority: the "keyword" part is already subsumed by (C)/Huma, and Cashus's genuinely hard rules (future-date checks, live-balance-dependent repayment amounts) are exactly the ones no portable DSL here would cover anyway.
6. **D — Schema-first rewrite (oapi-codegen-driven).** Last: solves the same problem as (C) at a much higher cost, reversing a migration the backend team just finished and re-opening a duplication trade-off (ADR-0001) the team already declined once.

---

**No code changes made.** This document is the sole deliverable of the CASH-14 spike.
