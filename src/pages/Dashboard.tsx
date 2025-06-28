import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CreateFriendModal } from '../components/CreateFriendModal';
import { formatCurrency } from '../utils/currency';
import type { FriendshipResponse, DebtTransactionResponse } from '../types/api';
import apiClient from '../services/api';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [friendships, setFriendships] = useState<FriendshipResponse[]>([]);
  const [transactions, setTransactions] = useState<DebtTransactionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateFriendModalOpen, setIsCreateFriendModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [friendshipsData, transactionsData] = await Promise.all([
        apiClient.getFriendships(),
        apiClient.getDebtTransactions(),
      ]);
      setFriendships(friendshipsData);
      setTransactions(transactionsData);
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <button
                    onClick={handleNewTransaction}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    New Transaction
                  </button>
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
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
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
