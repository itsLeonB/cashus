import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import type { GroupExpenseResponse } from '../types/api';
import { formatCurrency } from '../utils/currency';
import { handleApiError } from '../utils/api';
import { calculateItemAmount } from '../utils/groupExpense';

const GroupExpenseDetails: React.FC = () => {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<GroupExpenseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expenseId) {
      fetchExpenseDetails();
    }
  }, [expenseId]);

  const fetchExpenseDetails = async () => {
    if (!expenseId) return;

    try {
      setLoading(true);
      const expenseData = await apiClient.getGroupExpenseDetails(expenseId);
      setExpense(expenseData);
    } catch (err) {
      setError(handleApiError(err));
      console.error('Error fetching expense details:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateItemsTotal = () => {
    if (!expense) return 0;
    return expense.items.reduce((total, item) => {
      return total + calculateItemAmount(item);
    }, 0);
  };

  const calculateFeesTotal = () => {
    if (!expense?.otherFees) return 0;
    return expense.otherFees.reduce((total, fee) => {
      return total + (parseFloat(fee.amount) || 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expense details...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Expense</h3>
          <p className="text-gray-600 mb-6">{error || 'Expense not found'}</p>
          <Link
            to="/group-expenses"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Group Expenses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/group-expenses')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {expense.description || 'Group Expense'}
              </h1>
              <p className="text-gray-600 mt-1">Expense Details</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Items</h2>
              <div className="space-y-3">
                {expense.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.quantity} × {formatCurrency(item.amount)} each
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(calculateItemAmount(item).toString())}
                        </div>
                      </div>
                      <Link
                        to={`/group-expenses/${expense.id}/items/${item.id}/edit`}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-gray-700">Items Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(calculateItemsTotal().toString())}</span>
                </div>
              </div>
            </div>

            {/* Other Fees */}
            {expense.otherFees && expense.otherFees.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Fees</h2>
                <div className="space-y-3">
                  {expense.otherFees.map(fee => (
                    <div key={fee.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{fee.name}</h3>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(fee.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-4 pt-4">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-gray-700">Fees Subtotal:</span>
                    <span className="text-gray-900">{formatCurrency(calculateFeesTotal().toString())}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Total Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid by:</span>
                  <span className="font-medium text-gray-900">
                    {expense.paidByUser ? 'You' : (expense.payerName || 'Unknown')}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Total:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(calculateItemsTotal().toString())}
                  </span>
                </div>

                {expense.otherFees && expense.otherFees.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Additional Fees:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(calculateFeesTotal().toString())}
                    </span>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(expense.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expense Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Expense Info</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600 block">Total Items:</span>
                  <span className="font-medium text-gray-900">
                    {expense.items.length} items ({expense.items.reduce((total, item) => total + item.quantity, 0)} total quantity)
                  </span>
                </div>

                {expense.otherFees && expense.otherFees.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600 block">Additional Fees:</span>
                    <span className="font-medium text-gray-900">
                      {expense.otherFees.length} fees
                    </span>
                  </div>
                )}

                {expense.payerProfileId && (
                  <div>
                    <span className="text-sm text-gray-600 block">Payer:</span>
                    <span className="font-medium text-gray-900 text-sm">
                      {expense.paidByUser ? 'You' : expense.payerName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/group-expenses')}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Back to All Expenses
                </button>
                <Link
                  to="/group-expenses/new"
                  className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create New Expense
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupExpenseDetails;
