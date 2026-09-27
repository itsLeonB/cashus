// Request/response types for the API.
//
// Types for endpoints the OpenAPI schema covers are re-exported from
// schema.gen.ts (`export type X = components["schemas"]["Y"]`) rather than
// callers importing from schema.gen.ts directly — this keeps `from
// "./types"` a stable import path for every existing call site regardless
// of which side (hand-written vs. generated) a given type currently comes
// from. See frontend/CLAUDE.md's "API codegen" section.
//
// CASH-19 re-exported auth + profile only, as a deliberate first-slice
// scope boundary. CASH-20 audited every remaining hand-written interface
// here field-by-field against backend/openapi.json's components.schemas and
// re-exported everything that was a genuine match, leaving the rest
// hand-written with a rationale comment at each. CASH-21 (two rounds) went
// through that leftover list item by item:
//   - Migrated after a minor backend Huma fix (a response DTO field typed
//     as a bare Go `string` instead of the enum type the entity layer
//     already had, with no `enum:"..."` struct tag): GroupExpenseResponse,
//     ExpenseBillResponse.
//   - Migrated after fixing a real frontend bug the mismatch was masking
//     (ExpenseFeeModal.tsx's fallback calculation-method options didn't
//     match the backend's real enum): NewOtherFeeRequest,
//     UpdateOtherFeeRequest.
//   - Migrated after a refactor moved a load-bearing field out of the
//     request body and into its own function parameter:
//     UpdateExpenseItemRequest.
//   - Migrated as a straight derivation/composition with no backend change
//     needed: DebtDirection (indexes into an already-enum-tagged generated
//     field), ApiError (composed on the generated ErrorModel schema).
//   - Confirmed dead and deleted entirely: ExpenseItem, ItemParticipant,
//     FriendProfile, OtherFee, ExpenseOwnership, ApiResponse<T>.
// A later follow-up eliminated the last `Omit<...> & {...}` narrowing hacks
// (FriendshipResponse, FriendDetails, FriendDetailsResponse,
// FriendTransaction, DebtTransactionResponse all used to widen a `.type`
// field to `string` on the wire, requiring a manual re-narrow here): fixed
// by adding `enum:"..."` struct tags to the underlying backend DTO fields
// (introducing `dto.DebtTransactionType` where no named enum type existed
// yet), so the generated schema now carries the literal union directly.
// `ApiError`'s `& { isRefreshFailure?: boolean }` is the one remaining
// intersection and isn't a hack to fix: `isRefreshFailure` is a genuinely
// client-only bookkeeping flag with no wire representation at all, so there
// is nothing for the backend to emit here.
// What's still hand-written below is genuinely frontend-only/client-composed
// with no wire counterpart at all — each has its own comment explaining why.
import type { components } from "./schema.gen";

// Authentication Types
export type LoginRequest = components["schemas"]["LoginAuthInputBody"];
export type RegisterRequest = components["schemas"]["RegisterAuthInputBody"];
export type ResetPasswordRequest = components["schemas"]["ResetPasswordInputBody"];

// User Profile
export type UserProfile = components["schemas"]["ProfileResponse"];
export type CurrentSubscription = components["schemas"]["SubscriptionLimitsResponse"];
export type UploadLimit = components["schemas"]["UploadLimit"];

// Friendship Types
//
// Plain re-export as of this follow-up: `type` used to come back as a bare
// `string` in backend/openapi.json (no enum), so this and the three types
// below it (FriendDetails, FriendTransaction, DebtTransactionResponse) each
// kept an Omit+intersect to narrow `.type` back to a literal union without
// giving up drift protection on every other field. Fixed at the source
// instead: the backend DTO fields (dto.FriendshipResponse.Type,
// dto.FriendDetails.Type, dto.FriendTransactionItem.Type,
// dto.DebtTransactionResponse.Type) were plain Go `string` with no
// `enum:"..."` struct tag, even though `users.FriendshipType` and the new
// `dto.DebtTransactionType` already existed (or were introduced) as proper
// named enum types. Added the struct tags, so the generated schema now
// carries the literal union directly — no hack needed.
export type FriendshipResponse = components["schemas"]["FriendshipResponse"];

export type SearchProfileResult = components["schemas"]["SearchProfileResponse"];

// Plain re-export: backend/openapi.json's FriendDetailsResponse only ever had
// `friend` + `balancesPerCurrency` (both required) — there was no top-level
// `balance` or `redirectToRealFriendship` field on the wire type at all.
// `redirectToRealFriendship` was confirmed dead (unused anywhere in the
// app). `balance` was read only as a fallback in FriendDetailPage.tsx
// (`balancesPerCurrency[activeCurrency] || friendship?.balance`) — since the
// backend never sent a top-level `balance` field, that fallback could never
// actually fire, so it's now removed there too
// (`activeBalance = balancesPerCurrency[activeCurrency]`), fixing the
// dead-code bug CASH-20/21 originally flagged and deferred. Used to need an
// Omit+intersect to keep `friend.type` narrowed to a literal union; no
// longer necessary now that FriendDetails.type carries its own enum (see
// the FriendshipResponse comment above).
export type FriendDetailsResponse = components["schemas"]["FriendDetailsResponse"];

export type FriendDetails = components["schemas"]["FriendDetails"];
export type FriendBalance = components["schemas"]["FriendBalance"];
export type FriendTransaction = components["schemas"]["FriendTransactionItem"];

export type NewAnonymousFriendshipRequest =
  components["schemas"]["CreateAnonymousFriendshipInputBody"];

// Debt Transaction Types
// Derived (CASH-21 round 2) rather than hand-written: the backend inlines
// this as an `enum:"INCOMING,OUTGOING"`-tagged field on
// CreateDebtInputBody.direction rather than a standalone schema component,
// but Huma still carries that enum into the generated literal union, so
// indexing into it keeps drift protection instead of hand-duplicating the
// two literal values.
export type DebtDirection =
  components["schemas"]["CreateDebtInputBody"]["direction"];

export type DebtTransactionResponse = components["schemas"]["DebtTransactionResponse"];
export type NewDebtTransactionRequest = components["schemas"]["CreateDebtInputBody"];
export type NewRepaymentRequest = components["schemas"]["CreateRepaymentInputBody"];

export type TransferMethod = components["schemas"]["TransferMethodResponse"];
export type ProfileTransferMethod =
  components["schemas"]["ProfileTransferMethodResponse"];
export type NewProfileTransferMethod =
  components["schemas"]["AddProfileTransferMethodInputBody"];

export type SimpleProfile = components["schemas"]["SimpleProfile"];

// `ExpenseOwnership` (a frontend-only "OWNED" | "PARTICIPATING" query-param
// filter value candidate) was removed here in CASH-21: confirmed dead via a
// full-repo grep (unused anywhere outside its own declaration).
// ExpensesPage.tsx, the one place that actually needs this union, declares
// its own local `OwnershipType` instead — this hand-written export was never
// wired up to it. Note for anyone tempted to re-add it as a schema
// re-export: even though the backend has a real `expenses.ExpenseOwnership`
// Go enum type behind the `ownership` query param, Huma's query-parameter
// schema generation doesn't pick up the same `enum:"..."` struct-tag
// mechanism that made GroupExpenseResponse.status/ExpenseBillResponse.status/
// OtherFeeResponse.calculationMethod work below — backend/openapi.json still
// emits `{"type": "string"}` with no enum for `ownership`. Fixing that is a
// separate, slightly bigger Huma investigation (query-param schema
// generation, not just adding a struct tag) than the minor DTO-field fixes
// made in this ticket, so it's left as a follow-up rather than expanded into
// here.

// Group Expense Types
//
// Re-exported as of CASH-21. CASH-20 kept this fully hand-written because
// backend/openapi.json's GroupExpenseResponse.status was a plain `string`
// (no enum), which would have widened the literal union that
// `statusDisplay`/`RecentExpenses.tsx`/ExpensesPage.tsx compare against.
// CASH-21 traced that to a real (and minor) Huma gap: the DTO field was
// typed as a bare Go `string` with no `enum:"..."` struct tag, even though
// the entity layer already has a proper `expenses.ExpenseStatus` Go enum
// type. Fixed on the backend (dto.GroupExpenseResponse.Status is now typed
// `expenses.ExpenseStatus` with `enum:"DRAFT,READY,CONFIRMED"`), so the
// generated type now carries the same literal union this used to hand-roll.
// `items`/`otherFees`/`participants` are typed `T[] | null` here (nullable,
// not optional) per the generated schema — narrower than this interface's
// old `T[]`/`T[]?`, so call sites needed a couple of null-safety tweaks (see
// the CASH-21 report).
export type GroupExpenseResponse = components["schemas"]["GroupExpenseResponse"];

export const statusDisplay = {
  DRAFT: "Draft",
  READY: "Ready to Confirm",
  CONFIRMED: "Confirmed",
};

export type ExpenseItemResponse = components["schemas"]["ExpenseItemResponse"];

// Re-exporting fixes a real field-name drift: this hand-written interface
// used to declare `shareRatio: string`, but backend/openapi.json's
// ItemParticipantResponse has never had a `shareRatio` field — the actual
// field is `allocatedAmount`. `shareRatio` was never read anywhere in the
// app (confirmed via a full-repo grep), so this was dead/incorrect rather
// than load-bearing; re-exporting the generated type is a safe fix, not a
// behavior change for any caller.
export type ItemParticipantResponse = components["schemas"]["ItemParticipantResponse"];

export type OtherFeeResponse = components["schemas"]["OtherFeeResponse"];
export type ExpenseParticipantResponse =
  components["schemas"]["ExpenseParticipantResponse"];

// `ExpenseItem`/`ItemParticipant` (and the `FriendProfile` type
// `ItemParticipant.profile` used) were removed here in CASH-21: CASH-20 had
// already flagged these as dead — used only as the (unused) response-type
// parameter on groupExpensesApi.addItem/updateItem, which actually hit
// endpoints that return 204 No Content per backend/openapi.json (no
// response body at all; the mutation result is never read, onSuccess only
// invalidates queries) — and CASH-21 confirmed via a full-repo grep that
// nothing else referenced them, so they're deleted rather than migrated.
// group-expenses.ts's addItem/updateItem calls no longer pass a
// response-type generic, matching every other 204-No-Content call in that
// file (removeItem, removeFee, etc.).
//
// `OtherFee` was initially deleted alongside these on the same (incorrect)
// assumption that addFee/updateFee were also 204-No-Content — a CodeRabbit
// review on this PR caught the error: per backend/openapi.json, POST
// .../fees is 201 and PUT .../fees/{id} is 200, both with a real
// `EnvelopeOtherFeeResponse` JSON body, unlike the item endpoints. Fixed by
// typing `groupExpensesApi.addFee`/`updateFee` with the already-migrated
// `OtherFeeResponse` (below) as their response generic instead of
// reintroducing a hand-written `OtherFee` type.

// groupExpenseId is accepted here but never actually sent — addItem's HTTP
// call builds its body as {name, amount, quantity} explicitly, dropping it.
// Re-exporting the generated request-body schema (which correctly has no
// groupExpenseId field) removes this dead field; confirmed via grep that no
// caller reads NewExpenseItemRequest.groupExpenseId.
export type NewExpenseItemRequest = components["schemas"]["AddExpenseItemInputBody"];

// Plain re-export as of CASH-21 round 2: `id`/`groupExpenseId` used to be
// composed on top of the generated body here because
// groupExpensesApi.updateItem's URL was built from `data.groupExpenseId`.
// Refactored instead: updateItem now takes `groupExpenseId`/`itemId` as
// their own function parameters (matching removeItem's calling convention
// in the same file) rather than embedding them in the request body type, so
// this can be a straight re-export of the generated body schema.
export type UpdateExpenseItemRequest =
  components["schemas"]["UpdateExpenseItemInputBody"];

// Plain re-exports as of CASH-21 round 2. Previously stayed hand-written
// because the backend schema types `calculationMethod` as the literal union
// "EQUAL_SPLIT" | "ITEMIZED_SPLIT", but ExpenseFeeModal.tsx's fallback
// <SelectItem> options (shown before useCalculationMethods() resolves)
// offered "FLAT"/"PERCENTAGE" instead — a real, pre-existing bug (those
// values were never valid backend input), not a false mismatch to work
// around. Fixed at the source instead of papering over it here:
// ExpenseFeeModal.tsx's default state and fallback options now use the real
// enum values ("EQUAL_SPLIT"/"ITEMIZED_SPLIT"), with labels matching the
// backend's own fee-calculator display strings ("Equal split"/"Itemized
// split" — see other_fee_service.go's calculator registry). The hand-written
// `groupExpenseId?: string` field also dropped: like
// NewExpenseItemRequest's groupExpenseId before it, it was accepted here but
// never actually sent (addFee/updateFee build their HTTP body from
// name/amount/calculationMethod only and take groupExpenseId as their own
// function parameter instead — see group-expenses.ts).
export type NewOtherFeeRequest = components["schemas"]["AddOtherFeeInputBody"];
export type UpdateOtherFeeRequest =
  components["schemas"]["UpdateOtherFeeInputBody"];

export type FeeCalculationMethodInfo = components["schemas"]["FeeCalculationMethodInfo"];

export type ExpenseParticipantsRequest =
  components["schemas"]["SyncGroupExpenseParticipantsInputBody"];

export type SyncItemParticipantsRequest =
  components["schemas"]["SyncExpenseItemParticipantsInputBody"];

export type ExpenseConfirmationResponse =
  components["schemas"]["ExpenseConfirmationResponse"];
export type ConfirmedExpenseParticipant =
  components["schemas"]["ConfirmedExpenseParticipant"];
export type ConfirmedItemShare = components["schemas"]["ConfirmedItemShare"];

// Friend Request Types
export type FriendRequest = components["schemas"]["FriendshipRequestResponse"];

// Bill Types
//
// Re-exported as of CASH-21. CASH-20 kept this fully hand-written for two
// separate reasons, both resolved/confirmed this ticket:
//   1. backend/openapi.json's ExpenseBillResponse only had `id`, `imageUrl`,
//      `status`, `createdAt`, `updatedAt` — not the seven extra fields this
//      interface used to declare (`creatorProfileId`, `payerProfileId`,
//      `deletedAt`, `isCreatedByUser`, `isPaidByUser`,
//      `creatorProfileName`, `payerProfileName`). CASH-21 re-confirmed via a
//      full-repo grep that none of those seven fields are read anywhere —
//      genuinely dead, not a backend gap — so they're dropped rather than
//      migrated.
//   2. `status` was a plain `string` in backend/openapi.json (no enum),
//      which would have widened the literal union
//      ExpenseDetailPage.tsx's `billStatusDisplay` (declared
//      `satisfies Record<ExpenseBillResponse["status"], ...>`) depends on.
//      Same root cause and fix as GroupExpenseResponse.status above:
//      dto.ExpenseBillResponse.Status is now typed `expenses.BillStatus`
//      with an explicit `enum:"..."` struct tag, so the generated type
//      carries the exact 7-value literal union already.
export type ExpenseBillResponse = components["schemas"]["ExpenseBillResponse"];

export type PresignedExpenseBillResponse =
  components["schemas"]["PresignedExpenseBillResponse"];

// `ApiResponse<T>` (a generic `{data: T}` envelope wrapper) was removed here
// in CASH-21 round 2: confirmed dead via a full-repo grep — nothing outside
// its own declaration referenced it. `apiClient.request()` in client.ts
// already unwraps the backend's `{data: T}` envelope internally
// (`"data" in data ? data.data : data`) and returns bare `T` to every
// caller, so there was no shape left for this type to describe.

// Shape of one entry in the backend's `errors` array (see Huma's
// ErrorDetail), e.g. for per-field request validation failures.
export type ValidationError = components["schemas"]["ErrorDetail"];

// Derived directly on top of the generated Huma error model (CASH-21 round
// 2): `title`, `status` (HTTP status code), `detail` (human-readable
// explanation — RFC7807's own analog of what an earlier hand-written
// version of this type called `message`), `type`, `instance`, and
// `errors?: ErrorDetail[] | null` all come straight from
// components["schemas"]["ErrorModel"], with no synthetic `message`/
// `statusCode` fields duplicating `detail`/`status` on top — that synthetic
// layer was a leftover from before the frontend had access to the real
// backend error contract at all. `isRefreshFailure`/`isNetworkError` are the
// two genuinely frontend-only additions, with no backend counterpart: both
// describe failures that never produced an HTTP response body at all (a
// failed token refresh, a rejected `fetch()` before any response arrived),
// so there's nothing for the backend to have sent. Callers that need a
// display string compute one explicitly via `getApiErrorMessage` (see
// errors.ts) rather than reading a baked-in `.message` field.
export type ApiError = components["schemas"]["ErrorModel"] & {
  isRefreshFailure?: boolean;
  isNetworkError?: boolean;
};
