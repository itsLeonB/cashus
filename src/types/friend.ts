// Friend Details Types

export interface FriendDetails {
  id: string;
  profileId: string;
  name: string;
  type: 'ANON' | 'REAL';
  email?: string; // Only for registered friends
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface FriendBalance {
  totalOwedToYou: number; // Amount friend owes you
  totalYouOwe: number; // Amount you owe friend
  netBalance: number; // Positive = they owe you, Negative = you owe them
  currency: string;
}

export interface FriendTransaction {
  id: string;
  type: 'DEBT' | 'CREDIT';
  action: 'LEND' | 'BORROW' | 'RECEIVE' | 'RETURN';
  amount: number;
  description: string;
  transferMethod: string;
  createdAt: string;
  updatedAt: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface FriendStats {
  totalTransactions: number;
  firstTransactionDate?: string;
  lastTransactionDate?: string;
  mostUsedTransferMethod?: string;
  averageTransactionAmount: number;
}

export interface FriendDetailsResponse {
  friend: FriendDetails;
  balance: FriendBalance;
  transactions: FriendTransaction[];
  stats: FriendStats;
}

// Request types for future API endpoints
export interface UpdateFriendRequest {
  name?: string;
  email?: string;
  phone?: string;
}

export interface FriendTransactionFilters {
  type?: 'DEBT' | 'CREDIT';
  action?: 'LEND' | 'BORROW' | 'RECEIVE' | 'RETURN';
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}
