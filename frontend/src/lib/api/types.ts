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
// scope boundary. CASH-20 (this migration) audited every remaining
// hand-written interface here field-by-field against
// backend/openapi.json's components.schemas and re-exported everything
// that's a genuine match. What's still hand-written below falls into one
// of three buckets, each commented at its definition:
//   1. Frontend-only/client-composed shapes with no wire counterpart at all
//      (ApiError, ApiResponse<T>, DebtDirection, ...).
//   2. Types that partially match a schema but compose extra
//      frontend-only/routing fields on top (UpdateExpenseItemRequest, ...).
//   3. Types where re-exporting would erode a literal-union type the UI
//      depends on for exhaustive lookups, because the backend schema
//      declares the matching field as a plain `string` rather than an enum
//      (GroupExpenseResponse, ExpenseBillResponse) — see the CASH-20 final
//      report for the backend-follow-up suggestion.
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
// (no enum) here — the same situation as GroupExpenseResponse.status /
// ExpenseBillResponse.status below, which stay fully hand-written for that
// reason. Here an Omit+intersect gets the same literal-union protection
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

// Frontend-only/composed — no matching schema in backend/openapi.json.
// Currently only referenced from the (also frontend-only/unused, see
// ItemParticipant below) ItemParticipant.profile field.
export interface FriendProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  email?: string;
}

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

// Expense Ownership Types
// Frontend-only: a query-param filter value, not a wire schema.
export type ExpenseOwnership = "OWNED" | "PARTICIPATING";

// Group Expense Types
//
// Stays hand-written rather than re-exporting
// components["schemas"]["GroupExpenseResponse"] wholesale: its `status`
// field is a plain `string` in backend/openapi.json (no enum declared), so
// re-exporting would widen `status` away from the literal union that
// `statusDisplay`/`RecentExpenses.tsx`/etc. index into. Every nested type
// below (SimpleProfile, ExpenseItemResponse, OtherFeeResponse,
// ExpenseParticipantResponse, ExpenseConfirmationResponse) IS re-exported
// from the schema, so this composed interface only still hand-declares the
// fields the schema can't currently express precisely (`status`) plus
// `bill`, which is hand-written for the same reason (see ExpenseBillResponse
// below).
export interface GroupExpenseResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: string;
  itemsTotalAmount: string;
  feesTotalAmount: string;
  description?: string;
  status: "DRAFT" | "READY" | "CONFIRMED";
  isPreviewable: boolean;
  currency: string;

  // Relationships
  payer: SimpleProfile;
  creator: SimpleProfile;
  items: ExpenseItemResponse[];
  otherFees?: OtherFeeResponse[];
  participants?: ExpenseParticipantResponse[];
  bill: ExpenseBillResponse;
  billExists: boolean;

  confirmationPreview: ExpenseConfirmationResponse;
}

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

// Frontend-only/dead: used only as the (unused) response-type parameter on
// groupExpensesApi.addItem/updateItem, which actually hit endpoints that
// return 204 No Content per backend/openapi.json (no response body at all)
// — the mutation result is never read (onSuccess only invalidates
// queries). No plausible backend schema, and nothing depends on this shape
// being accurate. Flagged in the CASH-20 report as a cleanup candidate.
export interface ExpenseItem {
  id: string;
  name: string;
  amount: string;
  quantity: number;
  participants: ItemParticipant[];
}

// Frontend-only/dead — see ExpenseItem above.
export interface ItemParticipant {
  profileId: string;
  profile: FriendProfile;
  share: string;
}

// Frontend-only/dead — same situation as ExpenseItem above (addFee/updateFee
// also hit 204-No-Content endpoints).
export interface OtherFee {
  id: string;
  name: string;
  amount: string;
  calculationMethod: string;
}

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
// CASH-20 report as a separate, pre-existing-bug candidate.
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
// Stays hand-written: backend/openapi.json's ExpenseBillResponse only has
// `id`, `imageUrl`, `status`, `createdAt`, `updatedAt` — it does not have
// `creatorProfileId`, `payerProfileId`, `deletedAt`, `isCreatedByUser`,
// `isPaidByUser`, `creatorProfileName`, or `payerProfileName` at all.
// Confirmed via a full-repo grep that none of those seven fields are read
// anywhere outside this declaration — they're dead, not a backend gap.
// `status` is kept as a hand-written literal union (rather than the
// generated plain `string`) because ExpenseDetailPage.tsx's
// `billStatusDisplay` is declared `satisfies Record<ExpenseBillResponse["status"], ...>`
// for exhaustive status-to-label mapping; the backend schema doesn't
// declare `status` as an enum (see the CASH-20 report's backend-follow-up
// note).
export interface ExpenseBillResponse {
  id: string;
  creatorProfileId: string;
  payerProfileId: string;
  imageUrl?: string;
  status:
    | "PENDING"
    | "EXTRACTED"
    | "FAILED_EXTRACTING"
    | "PARSED"
    | "FAILED_PARSING"
    | "NOT_DETECTED"
    | "NOT_UPLOADED";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isCreatedByUser: boolean;
  isPaidByUser: boolean;
  creatorProfileName: string;
  payerProfileName: string;
}

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
