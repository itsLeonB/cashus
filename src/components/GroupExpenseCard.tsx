import React from 'react';
import { Link } from 'react-router-dom';
import type { GroupExpenseResponse } from '../types/api';
import { formatCurrency } from '../utils/currency';
import { truncateText } from '../utils/ui';
import { calculateItemAmount } from '../utils/groupExpense';

interface GroupExpenseCardProps {
  expense: GroupExpenseResponse;
}

const GroupExpenseCard: React.FC<GroupExpenseCardProps> = ({ expense }) => {
  const calculateTotalItems = () => {
    return expense.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getExpenseSummaryText = () => {
    const itemCount = expense.items.length;
    const totalQuantity = calculateTotalItems();

    if (itemCount === 1) {
      return `1 item (${totalQuantity} total)`;
    }

    return `${itemCount} items (${totalQuantity} total)`;
  };

  return (
    <Link to={`/group-expenses/${expense.id}`} className="block">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {truncateText(expense.description || 'Group Expense', 50)}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                {formatCurrency(expense.totalAmount)}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 7a2 2 0 012-2h10a2 2 0 012 2v2M5 11v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
                </svg>
                {getExpenseSummaryText()}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Paid by: {expense.paidByUser ? 'You' : (expense.payerName || 'Unknown')}
              </span>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Items:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {expense.items.slice(0, 4).map((item, itemIndex) => (
              <div key={item.id || itemIndex} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded">
                <span className="text-gray-700">
                  {truncateText(item.name, 20)} x{item.quantity}
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(calculateItemAmount(item).toString())}
                </span>
              </div>
            ))}
            {expense.items.length > 4 && (
              <div className="text-sm text-gray-500 italic">
                +{expense.items.length - 4} more items...
              </div>
            )}
          </div>
        </div>

        {/* Other Fees */}
        {expense.otherFees && expense.otherFees.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Fees:</h4>
            <div className="space-y-1">
              {expense.otherFees.map((fee, feeIndex) => (
                <div key={fee.id || feeIndex} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{truncateText(fee.name, 25)}</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(fee.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default GroupExpenseCard;
