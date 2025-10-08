// API Types based on the Go backend DTOs

export interface ApiResponse<T> {
  message: string;
  data: T;
  error: unknown;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  type: string;
  token: string;
}

export interface RegisterResponse {
  message: string;
}

export interface SendPasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  passwordConfirmation: string;
}

export interface ProfileResponse {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NewAnonymousFriendshipRequest {
  name: string;
}

export interface FriendshipResponse {
  id: string;
  type: "ANON" | "REAL";
  profileId: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TransferMethodResponse {
  id: string;
  name: string;
  display: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface NewDebtTransactionRequest {
  friendProfileId: string;
  action: "LEND" | "BORROW" | "RECEIVE" | "RETURN";
  amount: number;
  transferMethodId: string;
  description?: string;
}

export interface DebtTransactionResponse {
  id: string;
  profileId: string;
  type: "DEBT" | "CREDIT";
  amount: string;
  transferMethod: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Error handling types
export interface ApiErrorResponse {
  status: number;
  statusText?: string;
  data?: {
    message?: string;
    error?: string;
    errors?: Record<string, string[]>;
    [key: string]: any;
  };
  headers?: Record<string, string>;
}

export interface ApiErrorRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
}

export interface ApiError extends Error {
  name: string;
  message: string;
  response?: ApiErrorResponse;
  request?: ApiErrorRequest;
  code?: string;
  config?: {
    url?: string;
    method?: string;
    baseURL?: string;
    timeout?: number;
    [key: string]: any;
  };
  isAxiosError?: boolean;
  toJSON?: () => object;
}
