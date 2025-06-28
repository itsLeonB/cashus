import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../services/api';
import type { FriendshipResponse, TransferMethodResponse } from '../types/api';

const NewTransaction: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [transferMethods, setTransferMethods] = useState<TransferMethodResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    friendProfileId: '',
    action: 'LEND' as 'LEND' | 'BORROW' | 'RECEIVE' | 'RETURN',
    amount: '',
    transferMethodId: '',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [friendsData, transferMethodsData] = await Promise.all([
          apiClient.getFriendships(),
          apiClient.getTransferMethods(),
        ]);
        setFriends(friendsData);
        setTransferMethods(transferMethodsData);
        
        // Pre-select friend if coming from friend details page
        const preSelectedFriendId = searchParams.get('friendId');
        if (preSelectedFriendId) {
          setFormData(prev => ({
            ...prev,
            friendProfileId: preSelectedFriendId,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('Failed to load required data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.friendProfileId) {
      setError('Please select a friend');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!formData.transferMethodId) {
      setError('Please select a transfer method');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.createDebtTransaction({
        friendProfileId: formData.friendProfileId,
        action: formData.action,
        amount: parseFloat(formData.amount), // Send as-is, no conversion
        transferMethodId: formData.transferMethodId,
        description: formData.description || undefined,
      });

      const friendId = friends.find(friend => friend.profileId === formData.friendProfileId)?.id;

      navigate(`/friends/${friendId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
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
              <h1 className="text-3xl font-bold text-gray-900">New Transaction</h1>
              <p className="text-gray-600">Create a new debt transaction</p>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Friend Selection */}
                <div>
                  <label htmlFor="friendProfileId" className="block text-sm font-medium text-gray-700 mb-2">
                    Friend
                  </label>
                  <select
                    id="friendProfileId"
                    name="friendProfileId"
                    value={formData.friendProfileId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a friend</option>
                    {friends.map((friend) => (
                      <option key={friend.id} value={friend.profileId}>
                        {friend.profileName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Selection */}
                <div>
                  <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    id="action"
                    name="action"
                    value={formData.action}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="LEND">Lend (I gave money to friend)</option>
                    <option value="BORROW">Borrow (I received money from friend)</option>
                    <option value="RECEIVE">Receive (Friend paid me back)</option>
                    <option value="RETURN">Return (I paid friend back)</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({import.meta.env.VITE_CURRENCY_SYMBOL || 'Rp'})
                  </label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Transfer Method */}
                <div>
                  <label htmlFor="transferMethodId" className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Method
                  </label>
                  <select
                    id="transferMethodId"
                    name="transferMethodId"
                    value={formData.transferMethodId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select transfer method</option>
                    {transferMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.display}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="What was this transaction for?"
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isSubmitting ? 'Creating...' : 'Create Transaction'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewTransaction;
