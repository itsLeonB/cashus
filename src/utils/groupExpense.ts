import type { NewGroupExpenseRequest, NewExpenseitemRequest, NewOtherFeeRequest, ExpenseItemResponse } from '../types/api';

/**
 * Calculate the total amount for a single expense item with proper validation
 * Handles edge cases like invalid amounts, negative values, and missing data
 * 
 * @param item - The expense item to calculate amount for
 * @returns The total amount (price * quantity) or 0 if invalid
 * 
 * @example
 * calculateItemAmount({ name: 'Coffee', amount: '5.50', quantity: 2 }) // returns 11
 * calculateItemAmount({ name: 'Invalid', amount: 'abc', quantity: 1 }) // returns 0
 * calculateItemAmount({ name: 'Negative', amount: '-10', quantity: 1 }) // returns 0
 */
export const calculateItemAmount = (item: ExpenseItemResponse | NewExpenseitemRequest): number => {
  // Validate item exists
  if (!item) {
    return 0;
  }

  // Parse and validate amount
  const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : Number(item.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  // Validate quantity
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return 0;
  }

  // Calculate total with precision handling
  const total = amount * quantity;
  
  // Ensure result is finite and non-negative
  return Number.isFinite(total) && total >= 0 ? total : 0;
};

/**
 * Safely parse a numeric string value with validation
 * Used internally for consistent number parsing across utilities
 * 
 * @param value - String or number to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed number or default value
 */
export const safeParseNumber = (value: string | number, defaultValue: number = 0): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
};

/**
 * Calculate the total quantity of all items in a group expense
 */
export const calculateTotalItems = (expense: NewGroupExpenseRequest): number => {
  return expense.items.reduce((total, item) => total + item.quantity, 0);
};

/**
 * Calculate the total amount of all items in a group expense
 */
export const calculateItemsTotal = (items: (NewExpenseitemRequest | ExpenseItemResponse)[]): number => {
  return items.reduce((total, item) => {
    return total + calculateItemAmount(item);
  }, 0);
};

/**
 * Calculate the total amount of all other fees with proper validation
 */
export const calculateFeesTotal = (fees: NewOtherFeeRequest[]): number => {
  return fees.reduce((total, fee) => {
    return total + safeParseNumber(fee.amount);
  }, 0);
};

/**
 * Calculate the grand total of a group expense (items + fees)
 */
export const calculateGrandTotal = (items: (NewExpenseitemRequest | ExpenseItemResponse)[], fees: NewOtherFeeRequest[] = []): number => {
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
