import React, { useState, useEffect } from 'react';
import type { OtherFeeResponse, UpdateOtherFeeRequest, FeeCalculationMethodInfo } from '../types/groupExpense';
import { apiClient } from '../services/api';
import { handleApiError } from '../utils/api';

interface EditOtherFeeModalProps {
  fee: OtherFeeResponse;
  groupExpenseId: string;
  onClose: () => void;
  onUpdate: (updatedFee: OtherFeeResponse) => void;
}

const EditOtherFeeModal: React.FC<EditOtherFeeModalProps> = ({
  fee,
  groupExpenseId,
  onClose,
  onUpdate,
}) => {
  const [name, setName] = useState(fee.name);
  const [amount, setAmount] = useState(fee.amount);
  const [calculationMethod, setCalculationMethod] = useState(fee.calculationMethod);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeCalculationMethods, setFeeCalculationMethods] = useState<FeeCalculationMethodInfo[]>([]);

  useEffect(() => {
    fetchFeeCalculationMethods();
  }, []);

  const fetchFeeCalculationMethods = async () => {
    try {
      const methods = await apiClient.getFeeCalculationMethods();
      setFeeCalculationMethods(Array.isArray(methods) ? methods : []);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const updateRequest: UpdateOtherFeeRequest = {
        id: fee.id,
        groupExpenseId,
        name,
        amount,
        calculationMethod,
      };

      const updatedFee = await apiClient.updateOtherFee(updateRequest);
      onUpdate(updatedFee);
      onClose();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedMethod = feeCalculationMethods.find(m => m.name === calculationMethod);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Fee</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fee Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="calculation-method">
              Calculation Method
            </label>
            <select
              name="calculation-method"
              value={calculationMethod}
              onChange={(e) => setCalculationMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {feeCalculationMethods.length === 0 && (
                <option value="">No calculation methods available</option>
              )}
              {feeCalculationMethods.map((method) => (
                <option key={method.name} value={method.name}>
                  {method.display}
                </option>
              ))}
            </select>
            {selectedMethod?.description && (
              <p className="mt-1 text-sm text-gray-500">{selectedMethod.description}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditOtherFeeModal;
