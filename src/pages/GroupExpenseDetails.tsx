import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { handleApiError } from '../utils/api';
import { calculateItemAmount } from '../utils/groupExpense';
import type { FeeCalculationMethodInfo, GroupExpenseResponse, OtherFeeResponse, ExpenseItemResponse } from '../types/groupExpense';
import EditOtherFeeModal from '../components/EditOtherFeeModal';
import AddExpenseItemModal from '../components/AddExpenseItemModal';
import AddOtherFeeModal from '../components/AddOtherFeeModal';

const GroupExpenseDetails: React.FC = () => {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<GroupExpenseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingExpense, setConfirmingExpense] = useState(false);
  const [feeCalculationMethods, setFeeCalculationMethods] = useState<FeeCalculationMethodInfo[]>([]);
  const [editingFee, setEditingFee] = useState<OtherFeeResponse | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);

  useEffect(() => {
    if (expenseId) {
      fetchExpenseDetails();
    }
  }, [expenseId]);

  const fetchExpenseDetails = async () => {
    if (!expenseId) return;

    try {
      setLoading(true);
      const [expenseData, feeMethodsData] = await Promise.all([
        apiClient.getGroupExpenseDetails(expenseId),
        apiClient.getFeeCalculationMethods()
      ]);
      setExpense(expenseData);
      setFeeCalculationMethods(Array.isArray(feeMethodsData) ? feeMethodsData : []);
    } catch (err) {
      setError(handleApiError(err));
      console.error('Error fetching expense details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCalculationMethodDisplay = (methodName: string): string => {
    const method = feeCalculationMethods.find(m => m.name === methodName);
    return method ? method.display : methodName;
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

  const hasItemsWithoutParticipants = () => {
    if (!expense) return false;
    return expense.items.some(item => !item.participants || item.participants.length === 0);
  };

  const canConfirmExpense = () => {
    if (!expense) return false;
    return !expense.confirmed &&
      !expense.participantsConfirmed &&
      !hasItemsWithoutParticipants() &&
      expense.createdByUser;
  };

  const canEditExpense = () => {
    if (!expense) return false;
    return !expense.participantsConfirmed;
  };

  const handleConfirmExpense = async () => {
    if (!expense || !canConfirmExpense()) return;

    try {
      setConfirmingExpense(true);
      setError(null);
      const updatedExpense = await apiClient.confirmDraftGroupExpense(expense.id);
      setExpense(updatedExpense);
    } catch (err) {
      setError(handleApiError(err));
      console.error('Error confirming expense:', err);
    } finally {
      setConfirmingExpense(false);
    }
  };

  const handleAddItem = (newItem: ExpenseItemResponse) => {
    if (!expense) return;
    setExpense({
      ...expense,
      items: [...expense.items, newItem]
    });
  };

  const handleAddFee = (newFee: OtherFeeResponse) => {
    if (!expense) return;
    setExpense({
      ...expense,
      otherFees: expense.otherFees ? [...expense.otherFees, newFee] : [newFee]
    });
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/group-expenses')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {expense.description || 'Group Expense'}
                  </h1>
                  {expense.confirmed && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Confirmed
                    </span>
                  )}
                  {!expense.confirmed && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mt-1">Expense Details</p>
              </div>
            </div>

            {/* Confirm Button */}
            {!expense.confirmed && (
              <div className="flex items-center space-x-3">
                {hasItemsWithoutParticipants() && (
                  <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span>Some items need participants</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleConfirmExpense}
                  disabled={!canConfirmExpense() || confirmingExpense}
                  className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${canConfirmExpense() && !confirmingExpense
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {confirmingExpense ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Expense
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Items</h2>
                {canEditExpense() && (
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Item
                  </button>
                )}
              </div>

              {expense.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p>No items added yet</p>
                  {canEditExpense() && (
                    <button
                      onClick={() => setShowAddItemModal(true)}
                      className="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add First Item
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {expense.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{item.name}</h3>
                          {(!item.participants || item.participants.length === 0) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              No participants
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.quantity} × {formatCurrency(item.amount)} each
                        </div>
                        {item.participants && item.participants.length > 0 && (
                          <div className="text-sm text-gray-500 mt-1">
                            Participants: {item.participants.map(p => p.profileName).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(calculateItemAmount(item).toString())}
                          </div>
                        </div>
                        {canEditExpense() ? (
                          <Link
                            to={`/group-expenses/${expense.id}/items/${item.id}/edit`}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Link>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-gray-700">Items Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(calculateItemsTotal().toString())}</span>
                </div>
              </div>
            </div>

            {/* Other Fees */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Additional Fees</h2>
                {canEditExpense() && (
                  <button
                    onClick={() => setShowAddFeeModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Fee
                  </button>
                )}
              </div>

              {!expense.otherFees || expense.otherFees.length === 0 ? (
                <div>
                </div>
              ) : (
                <div className="space-y-3">
                  {expense.otherFees.map(fee => (
                    <div key={fee.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{fee.name}</h3>
                        <div className="text-sm text-gray-600 mt-1">
                          Calculation method: {getCalculationMethodDisplay(fee.calculationMethod)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(fee.amount)}
                          </div>
                        </div>
                        {canEditExpense() && (
                          <button
                            onClick={() => setEditingFee(fee)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-gray-700">Fees Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(calculateFeesTotal().toString())}</span>
                </div>
              </div>
            </div>
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
                  <span className="text-sm text-gray-600 block">Status:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    {expense.confirmed ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Draft
                      </span>
                    )}
                    {expense.participantsConfirmed && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Participants Confirmed
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600 block">Total Items:</span>
                  <span className="font-medium text-gray-900">
                    {expense.items.length} items ({expense.items.reduce((total, item) => total + item.quantity, 0)} total quantity)
                  </span>
                </div>

                <div>
                  <span className="text-sm text-gray-600 block">Items with Participants:</span>
                  <span className="font-medium text-gray-900">
                    {expense.items.filter(item => item.participants && item.participants.length > 0).length} / {expense.items.length}
                  </span>
                </div>

                {expense.otherFees && expense.otherFees.length > 0 && (
                  <>
                    <div>
                      <span className="text-sm text-gray-600 block">Additional Fees:</span>
                      <span className="font-medium text-gray-900">
                        {expense.otherFees.length} fees
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 block">Fee Details:</span>
                      <div className="mt-1 space-y-1">
                        {expense.otherFees.map(fee => (
                          <div key={fee.id} className="text-sm">
                            <span className="font-medium text-gray-900">{fee.name}</span>
                            <span className="text-gray-600"> - {getCalculationMethodDisplay(fee.calculationMethod)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
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

      {/* Modals */}
      {showAddItemModal && (
        <AddExpenseItemModal
          groupExpenseId={expense.id}
          onClose={() => setShowAddItemModal(false)}
          onAdd={handleAddItem}
        />
      )}

      {showAddFeeModal && (
        <AddOtherFeeModal
          groupExpenseId={expense.id}
          feeCalculationMethods={feeCalculationMethods}
          onClose={() => setShowAddFeeModal(false)}
          onAdd={handleAddFee}
        />
      )}

      {editingFee && expense && (
        <EditOtherFeeModal
          fee={editingFee}
          groupExpenseId={expense.id}
          onClose={() => setEditingFee(null)}
          onUpdate={(updatedFee) => {
            if (expense.otherFees) {
              const updatedFees = expense.otherFees.map(f =>
                f.id === updatedFee.id ? updatedFee : f
              );
              setExpense({
                ...expense,
                otherFees: updatedFees
              });
            }
            setEditingFee(null);
          }}
        />
      )}
    </div>
  );
};

export default GroupExpenseDetails;
