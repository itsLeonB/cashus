import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CreateFriendModal } from '../components/CreateFriendModal';
import { formatCurrency } from '../utils/currency';
import type { FriendshipResponse, DebtTransactionResponse, GroupExpenseResponse } from '../types/api';
import apiClient from '../services/api';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [friendships, setFriendships] = useState<FriendshipResponse[]>([]);
  const [transactions, setTransactions] = useState<DebtTransactionResponse[]>([]);
  const [groupExpenses, setGroupExpenses] = useState<GroupExpenseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateFriendModalOpen, setIsCreateFriendModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [friendshipsData, transactionsData, groupExpensesData] = await Promise.all([
        apiClient.getFriendships(),
        apiClient.getDebtTransactions(),
        apiClient.getCreatedGroupExpenses().catch(() => []), // Fallback to empty array if fails
      ]);
      setFriendships(friendshipsData);
      setTransactions(transactionsData);
      setGroupExpenses(groupExpensesData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleCreateFriendSuccess = () => {
    // Refresh the friendships data after successful creation
    fetchData();
  };

  const handleNewTransaction = () => {
    navigate('/transactions/new');
  };

  const handleFriendClick = (friendshipId: string) => {
    navigate(`/friends/${friendshipId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cashus</h1>
              <p className="text-gray-600">Welcome back, {user?.name}!</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleNewTransaction}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Transaction</span>
          </button>
          <button
            onClick={() => navigate('/group-expenses')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Group Expenses</span>
          </button>
          <button
            onClick={() => setIsCreateFriendModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Add Friend</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Friends Section */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Friends
                  </h3>
                  <button
                    onClick={() => setIsCreateFriendModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Add Friend
                  </button>
                </div>
                {friendships.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No friends added yet</p>
                ) : (
                  <div className="space-y-3">
                    {friendships.map((friendship) => (
                      <div
                        key={friendship.id}
                        onClick={() => handleFriendClick(friendship.id)}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{friendship.profileName}</p>
                          <p className="text-sm text-gray-500 capitalize">{friendship.type.toLowerCase()}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(friendship.createdAt), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Recent Transactions
                  </h3>
                </div>
                {transactions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-sm text-gray-500">{transaction.description}</p>
                          <p className="text-xs text-gray-400">{transaction.transferMethod}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${transaction.type === 'CREDIT'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {transaction.type}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(transaction.createdAt), 'MMM dd')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Group Expenses */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Group Expenses
                  </h3>
                  <button
                    onClick={() => navigate('/group-expenses')}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View All
                  </button>
                </div>
                {groupExpenses.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-3">No group expenses yet</p>
                    <button
                      onClick={() => navigate('/group-expenses/new')}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Create your first group expense
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupExpenses.slice(0, 3).map(expense => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => navigate(`/group-expenses/${expense.id}`)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {expense.description || 'Group Expense'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {expense.items.length} items • {formatCurrency(expense.totalAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-blue-600">
                            View Details
                          </span>
                        </div>
                      </div>
                    ))}
                    {groupExpenses.length > 3 && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => navigate('/group-expenses')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View {groupExpenses.length - 3} more expenses
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">+</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Owed to You
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(
                          transactions
                            .filter((t) => t.type === 'CREDIT')
                            .reduce((sum, t) => sum + parseInt(t.amount), 0)
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">-</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total You Owe
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(
                          transactions
                            .filter((t) => t.type === 'DEBT')
                            .reduce((sum, t) => sum + parseInt(t.amount), 0)
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">#</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Friends
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {friendships.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">G</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Group Expenses
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {groupExpenses.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Friend Modal */}
      <CreateFriendModal
        isOpen={isCreateFriendModalOpen}
        onClose={() => setIsCreateFriendModalOpen(false)}
        onSuccess={handleCreateFriendSuccess}
      />
    </div>
  );
};

export default Dashboard;
