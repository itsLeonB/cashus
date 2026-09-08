// Request/response types for the API.
//
// Some of these (currently: auth + profile) are re-exported from
// schema.gen.ts, generated from the backend's OpenAPI document — see
// frontend/CLAUDE.md's "API codegen" section. Everything else here is still
// hand-written, either because the backend's OpenAPI document doesn't cover
// it yet or because it's a frontend-only/client-composed shape (e.g.
// ApiError). Re-exporting keeps `from "./types"` a stable import path for
// every existing caller regardless of which side a given type comes from.
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
export interface FriendshipResponse {
  id: string;
  type: "ANON" | "REAL";
  profileId: string;
  profileName: string; // Used to be friendProfile.name
  profileAvatar?: string;
  balance?: number; // Calculated on frontend or separate? Legacy has no balance in FriendshipResponse
  balancesPerCurrency?: Record<string, string>; // currency -> netBalance as string
  createdAt: string;
}

export interface FriendProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  email?: string;
}

export interface SearchProfileResult {
  id: string;
  name: string;
  avatar?: string;
}

export interface FriendDetailsResponse {
  friend: FriendDetails;
  balance: FriendBalance;
  balancesPerCurrency?: Record<string, FriendBalance>;
  redirectToRealFriendship?: string;
}

export interface FriendDetails {
  id: string;
  profileId: string;
  name: string;
  type: "ANON" | "REAL";
  email?: string; // Only for registered friends
  phone?: string;
  avatar?: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface FriendBalance {
  netBalance: string;
  totalLentToFriend: string;
  totalBorrowedFromFriend: string;
  transactionHistory: FriendTransaction[];
}

export interface FriendTransaction {
  id: string;
  type: "LENT" | "BORROWED";
  amount: string;
  transferMethod: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  transactionDate: string; // "YYYY-MM-DD", the effective (possibly backdated) transaction date
  isRepayment: boolean;
}

export interface NewAnonymousFriendshipRequest {
  name: string;
}

// Debt Transaction Types
export type DebtDirection = "INCOMING" | "OUTGOING";

export interface DebtTransactionResponse {
  id: string;
  profile: SimpleProfile;
  type: "LENT" | "BORROWED";
  amount: string;
  currency: string;
  transferMethod: string;
  description: string;
  createdAt: string;
  transactionDate: string; // "YYYY-MM-DD", the effective (possibly backdated) transaction date
  isRepayment: boolean;
}

export interface NewDebtTransactionRequest {
  friendProfileId: string;
  direction: DebtDirection;
  amount: number;
  currency: string;
  transferMethodId: string;
  description?: string;
  transactionDate?: string; // "YYYY-MM-DD". Omitted -> defaults to today's date (server date).
}

export interface NewRepaymentRequest {
  friendProfileId: string;
  currency: string;
  transferMethodId: string;
  transactionDate?: string; // "YYYY-MM-DD". Omitted -> defaults to today's date (server date).
}

export interface TransferMethod {
  id: string;
  name: string;
  display: string;
  iconUrl: string;
  parentId: string;
}

export interface ProfileTransferMethod {
  id: string;
  method: TransferMethod;
  accountName: string;
  accountNumber: string;
}

export interface NewProfileTransferMethod {
  transferMethodId: string;
  accountName: string;
  accountNumber: string;
}

export interface SimpleProfile {
  id: string;
  name: string;
  avatar: string;
  isUser: boolean;
}

// Expense Ownership Types
export type ExpenseOwnership = "OWNED" | "PARTICIPATING";

// Group Expense Types
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

export interface ExpenseItemResponse {
  id: string;
  groupExpenseId: string;
  name: string;
  amount: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  participants: ItemParticipantResponse[];
}

export interface ItemParticipantResponse {
  profile: SimpleProfile;
  shareRatio: string;
  weight: number;
}

export interface OtherFeeResponse {
  id: string;
  name: string;
  amount: string;
  calculationMethod: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ExpenseParticipantResponse {
  participantProfile: SimpleProfile;
  proxyProfile?: SimpleProfile;
  shareAmount: string;
  hasProxy: boolean;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: string;
  quantity: number;
  participants: ItemParticipant[];
}

export interface ItemParticipant {
  profileId: string;
  profile: FriendProfile;
  share: string;
}

export interface OtherFee {
  id: string;
  name: string;
  amount: string;
  calculationMethod: string;
}

export interface NewExpenseItemRequest {
  groupExpenseId?: string;
  name: string;
  amount: string;
  quantity: number;
}

export interface NewOtherFeeRequest {
  groupExpenseId?: string;
  name: string;
  amount: string;
  calculationMethod: string;
}

export interface FeeCalculationMethodInfo {
  name: string;
  display: string;
  description: string;
}

export interface ExpenseParticipantsRequest {
  participantProfileIds: string[];
  proxyByProfileIds: Record<string, string>;
  payerProfileId: string;
}

export interface UpdateExpenseItemRequest {
  id: string;
  groupExpenseId: string;
  name: string;
  amount: string;
  quantity: number;
}

export interface UpdateOtherFeeRequest extends NewOtherFeeRequest {
  id: string;
}

export interface SyncItemParticipantsRequest {
  participants: ItemParticipantRequest[];
}

export interface ItemParticipantRequest {
  profileId: string;
  weight: number;
}

export interface ExpenseConfirmationResponse {
  id: string;
  description: string;
  totalAmount: string;
  currency: string;
  payer: SimpleProfile;
  participants: ConfirmedExpenseParticipant[];
}

export interface ConfirmedExpenseParticipant {
  profile: SimpleProfile;
  proxyProfile?: SimpleProfile;
  items: ConfirmedItemShare[];
  itemsTotal: string;
  fees: ConfirmedItemShare[];
  feesTotal: string;
  total: string;
  hasProxy: boolean;
}

export interface ConfirmedItemShare {
  id: string;
  name: string;
  baseAmount: string;
  shareRate: string;
  shareAmount: string;
}

// Friend Request Types
export interface FriendRequest {
  id: string;
  senderAvatar?: string;
  senderName: string;
  recipientAvatar?: string;
  recipientName: string;
  createdAt: string;
  blockedAt: string;
  isSentByUser: boolean;
  isReceivedByUser: boolean;
  isBlocked: boolean;
}

// Bill Types
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

export interface PresignedExpenseBillResponse {
  billId: string;
  uploadUrl: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
}

// Shape of one entry in the backend's `errors` array (see Huma's
// ErrorDetail), e.g. for per-field request validation failures.
export interface ValidationError {
  message?: string;
  location?: string;
  value?: unknown;
}

export interface ApiError {
  message: string;
  statusCode: number;
  isRefreshFailure?: boolean;
  errors?: ValidationError[];
}
