import type { NewGroupExpenseRequest, NewExpenseitemRequest, NewOtherFeeRequest } from '../types/api';

/**
 * Calculate the total quantity of all items in a group expense
 */
export const calculateTotalItems = (expense: NewGroupExpenseRequest): number => {
  return expense.items.reduce((total, item) => total + item.quantity, 0);
};

/**
 * Calculate the total amount of all items in a group expense
 */
export const calculateItemsTotal = (items: NewExpenseitemRequest[]): number => {
  return items.reduce((total, item) => {
    const itemAmount = parseFloat(item.amount) || 0;
    return total + (itemAmount * item.quantity);
  }, 0);
};

/**
 * Calculate the total amount of all other fees
 */
export const calculateFeesTotal = (fees: NewOtherFeeRequest[]): number => {
  return fees.reduce((total, fee) => {
    return total + (parseFloat(fee.amount) || 0);
  }, 0);
};

/**
 * Calculate the grand total of a group expense (items + fees)
 */
export const calculateGrandTotal = (items: NewExpenseitemRequest[], fees: NewOtherFeeRequest[] = []): number => {
  const itemsTotal = calculateItemsTotal(items);
  const feesTotal = calculateFeesTotal(fees);
  return itemsTotal + feesTotal;
};

/**
 * Validate a group expense item
 */
export const validateExpenseItem = (item: NewExpenseitemRequest): string | null => {
  if (!item.name.trim()) {
    return 'Item name is required';
  }
  if (!item.amount || parseFloat(item.amount) <= 0) {
    return 'Item amount must be greater than 0';
  }
  if (item.quantity < 1) {
    return 'Item quantity must be at least 1';
  }
  return null;
};

/**
 * Validate an other fee
 */
export const validateOtherFee = (fee: NewOtherFeeRequest): string | null => {
  if (!fee.name.trim()) {
    return 'Fee name is required';
  }
  if (!fee.amount || parseFloat(fee.amount) <= 0) {
    return 'Fee amount must be greater than 0';
  }
  return null;
};

/**
 * Validate a complete group expense
 */
export const validateGroupExpense = (
  description: string,
  items: NewExpenseitemRequest[],
  otherFees: NewOtherFeeRequest[]
): string | null => {
  if (!description.trim()) {
    return 'Description is required';
  }

  if (items.length === 0) {
    return 'At least one item is required';
  }

  // Validate all items
  for (let i = 0; i < items.length; i++) {
    const itemError = validateExpenseItem(items[i]);
    if (itemError) {
      return `Item ${i + 1}: ${itemError}`;
    }
  }

  // Validate all fees
  for (let i = 0; i < otherFees.length; i++) {
    const feeError = validateOtherFee(otherFees[i]);
    if (feeError) {
      return `Fee ${i + 1}: ${feeError}`;
    }
  }

  const totalAmount = calculateGrandTotal(items, otherFees);
  if (totalAmount <= 0) {
    return 'Total amount must be greater than 0';
  }

  return null;
};

/**
 * Create a new empty expense item
 */
export const createEmptyExpenseItem = (): NewExpenseitemRequest => ({
  name: '',
  amount: '',
  quantity: 1
});

/**
 * Create a new empty other fee
 */
export const createEmptyOtherFee = (): NewOtherFeeRequest => ({
  name: '',
  amount: ''
});

/**
 * Format items for API submission (calculate total amount per item)
 */
export const formatItemsForSubmission = (items: NewExpenseitemRequest[]): NewExpenseitemRequest[] => {
  return items.map(item => ({
    ...item,
    amount: item.amount.toString()
  }));
};

/**
 * Get expense summary text
 */
export const getExpenseSummaryText = (expense: NewGroupExpenseRequest): string => {
  const itemCount = expense.items.length;
  const totalQuantity = calculateTotalItems(expense);

  if (itemCount === 1) {
    return `1 item (${totalQuantity} total)`;
  }

  return `${itemCount} items (${totalQuantity} total)`;
};
