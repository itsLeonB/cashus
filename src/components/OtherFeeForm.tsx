import React from 'react';
import type { NewOtherFeeRequest, FeeCalculationMethodInfo } from '../types/groupExpense';

interface OtherFeeFormProps {
  fee: NewOtherFeeRequest;
  index: number;
  feeCalculationMethods: FeeCalculationMethodInfo[];
  onUpdate: (index: number, field: keyof NewOtherFeeRequest, value: string) => void;
  onRemove: (index: number) => void;
}

const OtherFeeForm: React.FC<OtherFeeFormProps> = ({
  fee,
  index,
  feeCalculationMethods,
  onUpdate,
  onRemove,
}) => {
  const selectedMethod = feeCalculationMethods.find(m => m.name === fee.calculationMethod);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Fee {index + 1}</h3>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`fee-name-${index}`}>
            Fee Name *
          </label>
          <input
            id={`fee-name-${index}`}
            type="text"
            value={fee.name}
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
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
            onChange={(e) => onUpdate(index, 'amount', e.target.value)}
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
            onChange={(e) => onUpdate(index, 'calculationMethod', e.target.value)}
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
          {selectedMethod?.description && (
            <p className="mt-1 text-sm text-gray-500">
              {selectedMethod.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtherFeeForm;
