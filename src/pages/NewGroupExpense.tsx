import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import type { ProfileResponse, FriendshipResponse } from '../types/api';
import { formatCurrency } from '../utils/currency';
import {
  validateGroupExpense,
  createEmptyExpenseItem,
  createEmptyOtherFee,
  calculateGrandTotal,
  calculateItemsTotal,
  calculateFeesTotal,
  formatItemsForSubmission,
  calculateItemAmount
} from '../utils/groupExpense';
import { handleApiError } from '../utils/api';
import { sanitizeString } from '../utils/form';
import type {
  FeeCalculationMethodInfo,
  NewExpenseItemRequest,
  NewGroupExpenseRequest,
  NewOtherFeeRequest,
} from '../types/groupExpense';

const NewGroupExpense: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [feeCalculationMethods, setFeeCalculationMethods] = useState<FeeCalculationMethodInfo[]>([]);

  // Form state
  const [description, setDescription] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('me'); // Default to 'me'
  const [items, setItems] = useState<NewExpenseItemRequest[]>([createEmptyExpenseItem()]);
  const [otherFees, setOtherFees] = useState<NewOtherFeeRequest[]>([]);
  const [showOtherFees, setShowOtherFees] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoadingInitialData(true);
      const [profileData, friendsData, feeMethodsData] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getFriendships().catch(() => []), // Fallback to empty array if fails
        apiClient.getFeeCalculationMethods().catch(() => []) // Fallback to empty array if fails
      ]);
      setProfile(profileData);
      setFriends(friendsData);
      setFeeCalculationMethods(Array.isArray(feeMethodsData) ? feeMethodsData : []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      // Don't set error here as it's not critical for form functionality
    } finally {
      setLoadingInitialData(false);
    }
  };

  const getSelectedPayerName = () => {
    if (selectedPayerId === 'me') {
      return profile?.name ? `Me (${profile.name})` : 'Me';
    }
    if (selectedPayerId === '') {
      return 'No one selected';
    }
    const selectedFriend = friends.find(friend => friend.profileId === selectedPayerId);
    return selectedFriend ? selectedFriend.profileName : 'Unknown';
  };

  const addItem = () => {
    setItems([...items, createEmptyExpenseItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof NewExpenseItemRequest, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const addOtherFee = () => {
    setOtherFees([...otherFees, createEmptyOtherFee()]);
  };

  const removeOtherFee = (index: number) => {
    setOtherFees(otherFees.filter((_, i) => i !== index));
  };

  const updateOtherFee = (index: number, field: keyof NewOtherFeeRequest, value: string) => {
    const updatedFees = [...otherFees];
    // Ensure we're creating a new object reference for the updated fee
    updatedFees[index] = {
      ...updatedFees[index],
      [field]: value
    };
    console.log('Updating fee:', { index, field, value, updatedFee: updatedFees[index] }); // Debug log
    setOtherFees(updatedFees);
  };

  const calculateTotal = () => {
    return calculateGrandTotal(items, otherFees);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Sanitize description
    const sanitizedDescription = sanitizeString(description);

    // Validation using utility function
    const validationError = validateGroupExpense(sanitizedDescription, items, otherFees);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Additional validation for payer selection
    if (selectedPayerId !== 'me' && selectedPayerId !== '' && !friends.find(f => f.profileId === selectedPayerId)) {
      setError('Selected payer is not valid. Please select a valid friend or "Me".');
      return;
    }

    try {
      setLoading(true);

      const groupExpenseData: NewGroupExpenseRequest = {
        totalAmount: calculateTotal().toString(),
        description: sanitizedDescription,
        items: formatItemsForSubmission(items),
        otherFees: otherFees.length > 0 ? otherFees : undefined
      };

      if (selectedPayerId !== 'me' && selectedPayerId !== '') {
        groupExpenseData.payerProfileId = selectedPayerId;
      }

      // Debug log
      console.log('Submitting group expense data:', JSON.stringify(groupExpenseData, null, 2));

      await apiClient.createDraftGroupExpense(groupExpenseData);
      navigate('/group-expenses', {
        state: {
          message: 'Draft group expense created successfully. You can now assign participants to each item.'
        }
      });
    } catch (err) {
      setError(handleApiError(err));
      console.error('Error creating group expense:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrencyDisplay = (amount: number) => {
    return formatCurrency(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Draft Group Expense</h1>
          <p className="text-gray-600 mt-2">
            Create a draft expense first, then assign participants to each item
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Dinner at Restaurant, Grocery Shopping"
                  required
                />
              </div>

              <div>
                <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-2">
                  Who paid for this expense?
                </label>
                <div className="relative">
                  <select
                    id="payer"
                    value={selectedPayerId}
                    onChange={(e) => setSelectedPayerId(e.target.value)}
                    disabled={loadingInitialData}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    {loadingInitialData ? (
                      <option value="me">Loading...</option>
                    ) : (
                      <>
                        <option value="me">
                          {profile?.name ? `Me (${profile.name})` : 'Me'}
                        </option>
                        <option value="" disabled>
                          -- Select a friend --
                        </option>
                        {friends.length === 0 ? (
                          <option value="" disabled>
                            No friends available
                          </option>
                        ) : (
                          friends.map((friend) => (
                            <option key={friend.id} value={friend.profileId}>
                              {friend.profileName}
                              {friend.type === 'ANON' ? ' (Anonymous)' : ''}
                            </option>
                          ))
                        )}
                      </>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    {loadingInitialData ? (
                      <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex items-start mt-2">
                  <div className="flex items-center h-5">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <p className="text-sm text-gray-500">
                      Select who actually paid for this expense. This helps track who owes money to whom.
                      {friends.length === 0 && (
                        <span className="block text-amber-600 mt-1">
                          💡 Add friends to select them as payers for shared expenses.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Item {index + 1}</h3>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="item-name">
                        Item Name *
                      </label>
                      <input
                        name="item-name"
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Pizza, Drinks"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="item-quantity">
                        Quantity *
                      </label>
                      <input
                        name="item-quantity"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="item-amount">
                        Price per Item *
                      </label>
                      <input
                        name="item-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        <span className="block">Subtotal:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrencyDisplay(calculateItemAmount(item))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Other Fees */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Additional Fees</h2>
              <div className="flex items-center space-x-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showOtherFees}
                    onChange={(e) => setShowOtherFees(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Add fees</span>
                </label>
                {showOtherFees && (
                  <button
                    type="button"
                    onClick={addOtherFee}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Add Fee
                  </button>
                )}
              </div>
            </div>

            {showOtherFees && (
              <div className="space-y-4">
                {otherFees.length === 0 ? (
                  <p className="text-gray-500 text-sm">No additional fees added yet.</p>
                ) : (
                  otherFees.map((fee, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Fee {index + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeOtherFee(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`fee-name-${index}`}>
                            Fee Name *
                          </label>
                          <input
                            id={`fee-name-${index}`}
                            type="text"
                            value={fee.name}
                            onChange={(e) => updateOtherFee(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Service Charge, Tax"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`fee-amount-${index}`}>
                            Amount *
                          </label>
                          <input
                            id={`fee-amount-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={fee.amount}
                            onChange={(e) => updateOtherFee(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`fee-calculation-${index}`}>
                            Calculation Method *
                          </label>
                          <select
                            id={`fee-calculation-${index}`}
                            value={fee.calculationMethod}
                            onChange={(e) => updateOtherFee(index, 'calculationMethod', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          >
                            <option value="">Select calculation method</option>
                            {feeCalculationMethods.map((method) => (
                              <option key={method.name} value={method.name}>
                                {method.display}
                              </option>
                            ))}
                          </select>
                          {fee.calculationMethod && feeCalculationMethods.find(m => m.name === fee.calculationMethod)?.description && (
                            <p className="mt-1 text-sm text-gray-500">
                              {feeCalculationMethods.find(m => m.name === fee.calculationMethod)?.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Total Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Paid by:</span>
                <span className="font-medium text-gray-900">
                  {getSelectedPayerName()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items Total:</span>
                <span className="font-medium">
                  {formatCurrencyDisplay(calculateItemsTotal(items))}
                </span>
              </div>
              {otherFees.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Additional Fees:</span>
                  <span className="font-medium">
                    {formatCurrencyDisplay(calculateFeesTotal(otherFees))}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span className="text-blue-600">{formatCurrencyDisplay(calculateTotal())}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate('/group-expenses')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Group Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewGroupExpense;
