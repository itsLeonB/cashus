// API Types based on the Go backend DTOs

export interface ApiResponse<T> {
  message: string;
  data: T;
  error: any;
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

export interface ProfileResponse {
  userId: string;
  profileId: string;
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
  type: 'ANON' | 'REAL';
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
  action: 'LEND' | 'BORROW' | 'RECEIVE' | 'RETURN';
  amount: number;
  transferMethodId: string;
  description?: string;
}

export interface DebtTransactionResponse {
  id: string;
  profileId: string;
  type: 'DEBT' | 'CREDIT';
  amount: string;
  transferMethod: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ApiError {
  message: string;
  code?: string;
}
