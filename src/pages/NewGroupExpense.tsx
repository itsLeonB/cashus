import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import type { NewGroupExpenseRequest, NewExpenseitemRequest, NewOtherFeeRequest } from '../types/api';
import { formatCurrency } from '../utils/currency';
import {
  validateGroupExpense,
  createEmptyExpenseItem,
  createEmptyOtherFee,
  calculateGrandTotal,
  calculateItemsTotal,
  calculateFeesTotal,
  formatItemsForSubmission
} from '../utils/groupExpense';
import { handleApiError } from '../utils/api';
import { sanitizeString } from '../utils/form';

const NewGroupExpense: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<NewExpenseitemRequest[]>([createEmptyExpenseItem()]);
  const [otherFees, setOtherFees] = useState<NewOtherFeeRequest[]>([]);
  const [showOtherFees, setShowOtherFees] = useState(false);

  const addItem = () => {
    setItems([...items, createEmptyExpenseItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof NewExpenseitemRequest, value: string | number) => {
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
    updatedFees[index] = { ...updatedFees[index], [field]: value };
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

    try {
      setLoading(true);

      const groupExpenseData: NewGroupExpenseRequest = {
        totalAmount: calculateTotal().toString(),
        description: sanitizedDescription,
        items: formatItemsForSubmission(items),
        otherFees: otherFees.length > 0 ? otherFees : undefined
      };

      await apiClient.createDraftGroupExpense(groupExpenseData);
      navigate('/group-expenses');
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
          <h1 className="text-3xl font-bold text-gray-900">Create Group Expense</h1>
          <p className="text-gray-600 mt-2">Add items and split expenses with your group</p>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Pizza, Drinks"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price per Item *
                      </label>
                      <input
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
                          {formatCurrencyDisplay((parseFloat(item.amount) || 0) * item.quantity)}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fee Name *
                          </label>
                          <input
                            type="text"
                            value={fee.name}
                            onChange={(e) => updateOtherFee(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Service Charge, Tax"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount *
                          </label>
                          <input
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
