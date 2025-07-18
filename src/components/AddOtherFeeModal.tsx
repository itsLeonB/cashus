import React, { useState } from 'react';
import { apiClient } from '../services/api';
import { handleApiError } from '../utils/api';
import type { NewOtherFeeRequest, OtherFeeResponse, FeeCalculationMethodInfo } from '../types/groupExpense';

interface AddOtherFeeModalProps {
  groupExpenseId: string;
  feeCalculationMethods: FeeCalculationMethodInfo[];
  onClose: () => void;
  onAdd: (fee: OtherFeeResponse) => void;
}

const AddOtherFeeModal: React.FC<AddOtherFeeModalProps> = ({
  groupExpenseId,
  feeCalculationMethods,
  onClose,
  onAdd
}) => {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    calculationMethod: feeCalculationMethods[0]?.name || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!feeCalculationMethods || feeCalculationMethods.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">No fee calculation methods available.</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-md">Close</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Fee name is required');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!formData.calculationMethod) {
      setError('Calculation method is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request: NewOtherFeeRequest = {
        groupExpenseId,
        name: formData.name.trim(),
        amount: formData.amount,
        calculationMethod: formData.calculationMethod
      };

      const newFee = await apiClient.addOtherFee(request);
      onAdd(newFee);
      onClose();
    } catch (err) {
      setError(handleApiError(err));
      console.error('Error adding other fee:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError(null);
  };

  const getCalculationMethodDisplay = (methodName: string): string => {
    const method = feeCalculationMethods.find(m => m.name === methodName);
    return method ? method.display : methodName;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Add Additional Fee</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="feeName" className="block text-sm font-medium text-gray-700 mb-2">
              Fee Name *
            </label>
            <input
              type="text"
              id="feeName"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Tax, Service Fee, Tip"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="feeAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">Rp</span>
              <input
                type="number"
                id="feeAmount"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="calculationMethod" className="block text-sm font-medium text-gray-700 mb-2">
              Calculation Method *
            </label>
            <select
              id="calculationMethod"
              value={formData.calculationMethod}
              onChange={(e) => handleInputChange('calculationMethod', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              {feeCalculationMethods.map(method => (
                <option key={method.name} value={method.name}>
                  {method.display}
                </option>
              ))}
            </select>
            {formData.calculationMethod && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {getCalculationMethodDisplay(formData.calculationMethod)}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Fee
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOtherFeeModal;
