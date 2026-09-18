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
// re-exported everything that was a genuine match. CASH-21 followed up on
// what CASH-20 left hand-written: some (GroupExpenseResponse,
// ExpenseBillResponse) turned out to be blocked by a minor Huma gap — a
// response DTO field typed as a bare Go `string` instead of the enum type
// the entity layer already had, with no `enum:"..."` struct tag — which
// CASH-21 fixed on the backend, then migrated here; others were confirmed
// dead and deleted (ExpenseItem, ItemParticipant, FriendProfile, OtherFee,
// ExpenseOwnership). What's still hand-written below falls into one of two
// buckets, each commented at its definition:
//   1. Frontend-only/client-composed shapes with no wire counterpart at all
//      (ApiError, ApiResponse<T>, DebtDirection, ...).
//   2. Types that partially match a schema but compose extra
//      frontend-only/routing fields on top (UpdateExpenseItemRequest, ...),
//      or where re-exporting would surface an existing, out-of-scope
//      frontend bug as a new type error (NewOtherFeeRequest,
//      UpdateOtherFeeRequest — see their own comment).
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
// Re-exported, but `type` is narrowed back to a literal union on top of the
// generated shape: backend/openapi.json declares `type` as a bare `string`
// (no enum) here — the same situation GroupExpenseResponse.status /
// ExpenseBillResponse.status used to be in, before CASH-21 added an explicit
// `enum:"..."` struct tag on those backend DTO fields (see their comments
// below). `FriendshipResponse.type` is a request/query-parameter-less plain
// response field with no equivalent fix available yet, so it keeps this
// Omit+intersect approach: it gets the same literal-union protection
// without giving up drift protection on every other field (id, profileId,
// profileAvatar, balancesPerCurrency, timestamps, ...), since those all do
// match the schema exactly. Same pattern used below for FriendDetails,
// DebtTransactionResponse, and FriendTransaction — all four have a `.type`
// field compared with `===` at call sites (FriendsPage.tsx,
// FriendDetailPage.tsx, TransactionHistory.tsx, RecentTransactions.tsx,
// utils/share.ts), so nothing breaks at runtime either way, but this keeps
// typo/rename protection on those comparisons instead of silently widening
// to `string`.
export type FriendshipResponse = Omit<
  components["schemas"]["FriendshipResponse"],
  "type"
> & { type: "ANON" | "REAL" };

export type SearchProfileResult = components["schemas"]["SearchProfileResponse"];

// FriendDetailsResponse stays hand-written: backend/openapi.json's
// FriendDetailsResponse only has `friend` + `balancesPerCurrency` (both
// required) — there is no top-level `balance` or `redirectToRealFriendship`
// field on the wire type at all. `redirectToRealFriendship` is unused
// anywhere in the app (dead). `balance` IS read, as a fallback, in
// FriendDetailPage.tsx (`balancesPerCurrency[activeCurrency] ||
// friendship?.balance`) — but the backend never sends a top-level `balance`
// field, so that fallback can never actually fire; this looks like a
// pre-existing bug (dead/wrong field read) rather than something safe to
// silently "fix" by dropping it here. Flagged in the CASH-20 report;
// left as-is pending a product/behavior decision. The nested types are
// re-exported below and used here to avoid duplicating them.
export interface FriendDetailsResponse {
  friend: FriendDetails;
  balance: FriendBalance;
  balancesPerCurrency?: Record<string, FriendBalance>;
  redirectToRealFriendship?: string;
}

// `type` narrowed to a literal union — see the FriendshipResponse comment
// above.
export type FriendDetails = Omit<components["schemas"]["FriendDetails"], "type"> & {
  type: "ANON" | "REAL";
};
export type FriendBalance = components["schemas"]["FriendBalance"];
// `type` narrowed to a literal union — see the FriendshipResponse comment
// above.
export type FriendTransaction = Omit<
  components["schemas"]["FriendTransactionItem"],
  "type"
> & { type: "LENT" | "BORROWED" };

export type NewAnonymousFriendshipRequest =
  components["schemas"]["CreateAnonymousFriendshipInputBody"];

// Debt Transaction Types
// Frontend-only alias: the backend inlines this as an enum on
// CreateDebtInputBody.direction rather than a standalone schema component.
export type DebtDirection = "INCOMING" | "OUTGOING";

// `type` narrowed to a literal union — see the FriendshipResponse comment
// above.
export type DebtTransactionResponse = Omit<
  components["schemas"]["DebtTransactionResponse"],
  "type"
> & { type: "LENT" | "BORROWED" };
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

// `ExpenseItem`/`ItemParticipant`/`OtherFee` (and the `FriendProfile` type
// `ItemParticipant.profile` used) were removed here in CASH-21: CASH-20 had
// already flagged these as dead — used only as the (unused) response-type
// parameter on groupExpensesApi.addItem/updateItem/addFee/updateFee, which
// actually hit endpoints that return 204 No Content per
// backend/openapi.json (no response body at all; the mutation result is
// never read, onSuccess only invalidates queries) — and CASH-21 confirmed
// via a full-repo grep that nothing else referenced them, so they're
// deleted rather than migrated. group-expenses.ts's addItem/updateItem/
// addFee/updateFee calls no longer pass a response-type generic, matching
// every other 204-No-Content call in that file (removeItem, removeFee,
// etc.).

// groupExpenseId is accepted here but never actually sent — addItem's HTTP
// call builds its body as {name, amount, quantity} explicitly, dropping it.
// Re-exporting the generated request-body schema (which correctly has no
// groupExpenseId field) removes this dead field; confirmed via grep that no
// caller reads NewExpenseItemRequest.groupExpenseId.
export type NewExpenseItemRequest = components["schemas"]["AddExpenseItemInputBody"];

// Stays hand-written, composed on top of the generated body: `id` and
// `groupExpenseId` are real, load-bearing frontend-only fields here —
// unlike NewExpenseItemRequest's groupExpenseId, updateItem's URL is built
// from `data.groupExpenseId` (see group-expenses.ts), so this one can't be
// dropped.
export type UpdateExpenseItemRequest =
  components["schemas"]["UpdateExpenseItemInputBody"] & {
    id: string;
    groupExpenseId: string;
  };

// NewOtherFeeRequest/UpdateOtherFeeRequest stay fully hand-written rather
// than re-exporting AddOtherFeeInputBody/UpdateOtherFeeInputBody: the
// backend schema types `calculationMethod` as the literal union
// "EQUAL_SPLIT" | "ITEMIZED_SPLIT", but ExpenseFeeModal.tsx's fallback
// <SelectItem> options (shown before useCalculationMethods() resolves)
// offer "FLAT"/"PERCENTAGE" instead, and calculationMethod there is plain
// react `useState<string>`. Re-exporting the narrower generated type would
// surface that mismatch as a real type error at that call site, but fixing
// it is a product/business-logic call (which values are actually valid to
// submit before the calculation-methods list has loaded), not something
// this type-migration ticket should silently paper over. Flagged in the
// CASH-20 report as a separate, pre-existing-bug candidate; CASH-21
// re-confirmed this is still the case (the fallback options still don't
// match the real enum) and left it alone per that ticket's explicit
// out-of-scope list.
export interface NewOtherFeeRequest {
  groupExpenseId?: string;
  name: string;
  amount: string;
  calculationMethod: string;
}

export interface UpdateOtherFeeRequest extends NewOtherFeeRequest {
  id: string;
}

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

// API Response wrapper
// Frontend-only: a generic wrapper type, not itself a wire shape.
export interface ApiResponse<T> {
  data: T;
}

// Shape of one entry in the backend's `errors` array (see Huma's
// ErrorDetail), e.g. for per-field request validation failures.
export type ValidationError = components["schemas"]["ErrorDetail"];

// Frontend-only/composed: assembled from a parsed error response plus
// frontend-added fields (isRefreshFailure), not itself a wire shape.
export interface ApiError {
  message: string;
  statusCode: number;
  isRefreshFailure?: boolean;
  errors?: ValidationError[];
}
