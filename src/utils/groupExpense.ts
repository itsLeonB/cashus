import type { NewExpenseItemRequest, NewOtherFeeRequest } from '../types/groupExpense';

export const createEmptyExpenseItem = (): NewExpenseItemRequest => ({
  name: '',
  amount: '',
  quantity: 1
});

export const createEmptyOtherFee = (): NewOtherFeeRequest => ({
  name: '',
  amount: '',
  calculationMethod: '' // Empty string to force selection
});

export const validateGroupExpense = (
  description: string,
  items: NewExpenseItemRequest[],
  otherFees: NewOtherFeeRequest[]
): string | null => {
  if (!description.trim()) {
    return 'Description is required';
  }

  if (items.length === 0) {
    return 'At least one item is required';
  }

  for (const item of items) {
    if (!item.name.trim()) {
      return 'Item name is required';
    }
    if (!item.amount || parseFloat(item.amount) <= 0) {
      return 'Item amount must be greater than 0';
    }
    if (!item.quantity || item.quantity <= 0) {
      return 'Item quantity must be greater than 0';
    }
  }

  for (const fee of otherFees) {
    if (!fee.name.trim()) {
      return 'Fee name is required';
    }
    if (!fee.amount || parseFloat(fee.amount) <= 0) {
      return 'Fee amount must be greater than 0';
    }
    if (!fee.calculationMethod) {
      return 'Fee calculation method is required';
    }
  }

  return null;
};

export const calculateItemAmount = (item: NewExpenseItemRequest): number => {
  const amount = parseFloat(item.amount) || 0;
  return amount * item.quantity;
};

export const calculateItemsTotal = (items: NewExpenseItemRequest[]): number => {
  return items.reduce((total, item) => total + calculateItemAmount(item), 0);
};

export const calculateFeesTotal = (fees: NewOtherFeeRequest[]): number => {
  return fees.reduce((total, fee) => total + (parseFloat(fee.amount) || 0), 0);
};

export const calculateGrandTotal = (
  items: NewExpenseItemRequest[],
  fees: NewOtherFeeRequest[]
): number => {
  return calculateItemsTotal(items) + calculateFeesTotal(fees);
};

export const formatItemsForSubmission = (
  items: NewExpenseItemRequest[]
): NewExpenseItemRequest[] => {
  return items.map(item => ({
    ...item,
    amount: item.amount.toString()
  }));
};
