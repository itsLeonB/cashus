// Mock API service for Friend Details functionality
// This will be replaced with real API calls once backend is implemented

import type { 
  FriendDetailsResponse, 
  FriendTransaction, 
  UpdateFriendRequest,
  FriendTransactionFilters 
} from '../types/friend';

// Mock data
const mockFriendDetails: Record<string, FriendDetailsResponse> = {
  'friend-1': {
    friend: {
      id: 'friendship-1',
      profileId: 'profile-1',
      name: 'Alice Johnson',
      type: 'ANON',
      email: 'alice@example.com',
      phone: '+62812345678',
      avatar: undefined,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-15T14:30:00Z',
    },
    balance: {
      totalOwedToYou: 250000,
      totalYouOwe: 100000,
      netBalance: 150000,
      currency: 'IDR',
    },
    transactions: [
      {
        id: 'trans-1',
        type: 'CREDIT',
        action: 'LEND',
        amount: 75000,
        description: 'Dinner at restaurant',
        transferMethod: 'Cash',
        createdAt: '2024-01-15T19:30:00Z',
        updatedAt: '2024-01-15T19:30:00Z',
        status: 'COMPLETED',
      },
      {
        id: 'trans-2',
        type: 'DEBT',
        action: 'BORROW',
        amount: 50000,
        description: 'Coffee and snacks',
        transferMethod: 'Bank Transfer',
        createdAt: '2024-01-14T10:15:00Z',
        updatedAt: '2024-01-14T10:15:00Z',
        status: 'COMPLETED',
      },
      {
        id: 'trans-3',
        type: 'CREDIT',
        action: 'RECEIVE',
        amount: 25000,
        description: 'Partial payment for lunch',
        transferMethod: 'E-Wallet',
        createdAt: '2024-01-13T16:45:00Z',
        updatedAt: '2024-01-13T16:45:00Z',
        status: 'COMPLETED',
      },
      {
        id: 'trans-4',
        type: 'CREDIT',
        action: 'LEND',
        amount: 150000,
        description: 'Movie tickets and popcorn',
        transferMethod: 'Cash',
        createdAt: '2024-01-12T20:00:00Z',
        updatedAt: '2024-01-12T20:00:00Z',
        status: 'COMPLETED',
      },
      {
        id: 'trans-5',
        type: 'DEBT',
        action: 'RETURN',
        amount: 50000,
        description: 'Paying back coffee money',
        transferMethod: 'Bank Transfer',
        createdAt: '2024-01-10T14:20:00Z',
        updatedAt: '2024-01-10T14:20:00Z',
        status: 'COMPLETED',
      },
    ],
    stats: {
      totalTransactions: 12,
      firstTransactionDate: '2024-01-01T10:00:00Z',
      lastTransactionDate: '2024-01-15T19:30:00Z',
      mostUsedTransferMethod: 'Cash',
      averageTransactionAmount: 65000,
    },
  },
  'friend-2': {
    friend: {
      id: 'friendship-2',
      profileId: 'profile-2',
      name: 'Bob Smith',
      type: 'REAL',
      email: 'bob@example.com',
      phone: '+62887654321',
      avatar: undefined,
      createdAt: '2024-01-05T15:20:00Z',
      updatedAt: '2024-01-10T09:15:00Z',
    },
    balance: {
      totalOwedToYou: 0,
      totalYouOwe: 125000,
      netBalance: -125000,
      currency: 'IDR',
    },
    transactions: [
      {
        id: 'trans-6',
        type: 'DEBT',
        action: 'BORROW',
        amount: 125000,
        description: 'Grocery shopping',
        transferMethod: 'E-Wallet',
        createdAt: '2024-01-10T11:30:00Z',
        updatedAt: '2024-01-10T11:30:00Z',
        status: 'PENDING',
      },
    ],
    stats: {
      totalTransactions: 3,
      firstTransactionDate: '2024-01-05T15:20:00Z',
      lastTransactionDate: '2024-01-10T11:30:00Z',
      mostUsedTransferMethod: 'E-Wallet',
      averageTransactionAmount: 85000,
    },
  },
};

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockFriendApiService {
  // Get friend details with balance and transactions
  static async getFriendDetails(friendId: string): Promise<FriendDetailsResponse> {
    await delay(800); // Simulate network delay
    
    const friendData = mockFriendDetails[friendId];
    if (!friendData) {
      throw new Error('Friend not found');
    }
    
    return friendData;
  }

  // Update friend information
  static async updateFriend(friendId: string, data: UpdateFriendRequest): Promise<FriendDetailsResponse['friend']> {
    await delay(600);
    
    const friendData = mockFriendDetails[friendId];
    if (!friendData) {
      throw new Error('Friend not found');
    }

    // Update the mock data
    const updatedFriend = {
      ...friendData.friend,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    mockFriendDetails[friendId].friend = updatedFriend;
    
    return updatedFriend;
  }

  // Get friend transactions with filtering
  static async getFriendTransactions(
    friendId: string, 
    filters?: FriendTransactionFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: FriendTransaction[]; total: number }> {
    await delay(500);
    
    const friendData = mockFriendDetails[friendId];
    if (!friendData) {
      throw new Error('Friend not found');
    }

    let transactions = [...friendData.transactions];

    // Apply filters
    if (filters) {
      if (filters.type) {
        transactions = transactions.filter(t => t.type === filters.type);
      }
      if (filters.action) {
        transactions = transactions.filter(t => t.action === filters.action);
      }
      if (filters.status) {
        transactions = transactions.filter(t => t.status === filters.status);
      }
      if (filters.minAmount) {
        transactions = transactions.filter(t => t.amount >= filters.minAmount!);
      }
      if (filters.maxAmount) {
        transactions = transactions.filter(t => t.amount <= filters.maxAmount!);
      }
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    return {
      transactions: paginatedTransactions,
      total: transactions.length,
    };
  }

  // Delete friend (soft delete)
  static async deleteFriend(friendId: string): Promise<void> {
    await delay(400);
    
    const friendData = mockFriendDetails[friendId];
    if (!friendData) {
      throw new Error('Friend not found');
    }

    // Mark as deleted
    mockFriendDetails[friendId].friend.deletedAt = new Date().toISOString();
  }

  // Get balance summary
  static async getFriendBalance(friendId: string) {
    await delay(300);
    
    const friendData = mockFriendDetails[friendId];
    if (!friendData) {
      throw new Error('Friend not found');
    }

    return {
      ...friendData.balance,
      breakdown: {
        lentAmount: 225000,
        borrowedAmount: 100000,
        receivedAmount: 25000,
        returnedAmount: 50000,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

export default MockFriendApiService;
