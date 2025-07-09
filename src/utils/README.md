# Utility Functions

This directory contains reusable utility functions organized by category. These utilities help maintain consistency and reduce code duplication across the application.

## 📁 File Structure

```
utils/
├── index.ts           # Re-exports all utilities
├── currency.ts        # Currency formatting functions
├── groupExpense.ts    # Group expense specific utilities
├── form.ts           # Form validation and input utilities
├── ui.ts             # UI/UX helper functions
├── date.ts           # Date formatting and manipulation
├── api.ts            # API error handling and utilities
└── README.md         # This file
```

## 🔧 Usage

You can import utilities in two ways:

### Individual imports (recommended for tree-shaking):
```typescript
import { formatCurrency } from '../utils/currency';
import { validateRequired } from '../utils/form';
```

### Bulk import:
```typescript
import { formatCurrency, validateRequired } from '../utils';
```

## 📚 Available Utilities

### 💰 Currency (`currency.ts`)
- `formatCurrency(amount)` - Format numbers as currency
- `getCurrencySymbol()` - Get configured currency symbol
- `getCurrencyCode()` - Get configured currency code

### 🌐 API Utilities (`api.ts`)
- `handleApiError(error)` - Extract user-friendly error messages with proper typing
- `isApiError(error)` - **NEW** Type guard for API errors
- `isNetworkError(error)` - **IMPROVED** Check for network connectivity issues
- `isAuthError(error)` - **IMPROVED** Check for authentication errors (401)
- `isValidationError(error)` - **IMPROVED** Check for validation errors (400/422)
- `isClientError(error)` - **NEW** Check for client errors (4xx)
- `isServerError(error)` - **NEW** Check for server errors (5xx)
- `isRetryableError(error)` - **NEW** Check if error should be retried
- `retryWithBackoff(fn, options)` - Retry failed requests with exponential backoff
- `createTimeoutPromise(ms)` - Create timeout promises for request cancellation
- `createDebouncedApiCall(apiCall, delay)` - Debounce API calls to prevent spam

### 🧾 Group Expense (`groupExpense.ts`)
- `calculateItemAmount(item)` - **NEW** Calculate total amount for single item with validation
- `calculateTotalItems(expense)` - Calculate total item quantity
- `calculateItemsTotal(items)` - Calculate total amount of items
- `calculateFeesTotal(fees)` - Calculate total amount of fees
- `calculateGrandTotal(items, fees)` - Calculate total expense amount
- `validateExpenseItem(item)` - Validate individual expense item
- `validateOtherFee(fee)` - Validate other fee
- `validateGroupExpense(description, items, fees)` - Validate complete expense
- `createEmptyExpenseItem()` - Create new empty item
- `createEmptyOtherFee()` - Create new empty fee
- `formatItemsForSubmission(items)` - Format items for API submission
- `getExpenseSummaryText(expense)` - Generate summary text
- `safeParseNumber(value, defaultValue)` - **NEW** Safely parse numeric values

### 📝 Form (`form.ts`)
- `isEmpty(value)` - Check if string is empty
- `validateRequired(value, fieldName)` - Validate required field
- `validateNumeric(value, fieldName, options)` - Validate numeric field
- `validateInteger(value, fieldName, options)` - Validate integer field
- `validateEmail(email)` - Validate email format
- `validatePassword(password, options)` - Validate password strength
- `sanitizeString(value)` - Clean and trim string
- `formatNumberInput(value)` - Format number input
- `formatIntegerInput(value)` - Format integer input

### 🎨 UI (`ui.ts`)
- `createLoadingState(message)` - Generate loading state props
- `createErrorState(message, retry)` - Generate error state props
- `createEmptyState(title, description, action)` - Generate empty state props
- `truncateText(text, maxLength)` - Truncate text with ellipsis
- `getInitials(name)` - Generate initials from name
- `getRandomColor(seed)` - Generate consistent random color
- `classNames(...classes)` - Combine CSS classes conditionally
- `debounce(func, wait)` - Debounce function calls
- `throttle(func, limit)` - Throttle function calls
- `copyToClipboard(text)` - Copy text to clipboard
- `formatFileSize(bytes)` - Format file size
- `generateId(prefix)` - Generate unique ID
- `isMobile()` - Check if device is mobile
- `scrollToElement(elementId, offset)` - Smooth scroll to element

### 📅 Date (`date.ts`)
- `formatDate(date, format)` - Format date with custom format
- `formatRelativeTime(date)` - Format relative time (e.g., "2 hours ago")
- `formatSmartDate(date)` - Smart date formatting based on recency
- `formatDateForInput(date)` - Format date for form inputs
- `formatDateTimeForInput(date)` - Format datetime for form inputs
- `getStartOfToday()` - Get start of current day
- `getEndOfToday()` - Get end of current day
- `isWithinLastDays(date, days)` - Check if date is within last N days
- `getAge(birthDate)` - Calculate age from birth date
- `formatDuration(milliseconds)` - Format duration in human readable format

### 🌐 API (`api.ts`)
- `handleApiError(error)` - Consistent API error handling
- `isNetworkError(error)` - Check if error is network-related
- `isAuthError(error)` - Check if error is authentication-related
- `isValidationError(error)` - Check if error is validation-related
- `retryWithBackoff(fn, maxRetries, baseDelay)` - Retry with exponential backoff
- `createTimeoutPromise(ms)` - Create timeout promise
- `withTimeout(promise, ms)` - Add timeout to promise
- `batchRequests(items, requestFn, concurrency)` - Batch API requests
- `ApiCache` - Cache class for API responses
- `createDebouncedApiCall(apiCall, delay)` - Create debounced API call

## 🎯 Examples

### Currency Formatting
```typescript
import { formatCurrency } from '../utils/currency';

const price = formatCurrency(150000); // "Rp 150,000"
const amount = formatCurrency("25000.50"); // "Rp 25,001"
```

### Form Validation
```typescript
import { validateRequired, validateNumeric, sanitizeString } from '../utils/form';

const nameError = validateRequired(name, 'Name');
const amountError = validateNumeric(amount, 'Amount', { min: 0 });
const cleanDescription = sanitizeString(description);
```

### API Error Handling
```typescript
import { 
  handleApiError, 
  isApiError, 
  isNetworkError, 
  isAuthError, 
  isValidationError,
  isRetryableError 
} from '../utils/api';

try {
  await apiCall();
} catch (error) {
  // Type-safe error handling
  if (isApiError(error)) {
    console.log('API Error:', error.response?.status);
    
    if (isAuthError(error)) {
      // Handle authentication errors
      redirectToLogin();
    } else if (isValidationError(error)) {
      // Handle validation errors
      showValidationErrors(error.response?.data?.errors);
    } else if (isNetworkError(error)) {
      // Handle network errors
      showNetworkErrorMessage();
    } else if (isRetryableError(error)) {
      // Retry server errors
      retryRequest();
    }
  }
  
  // Get user-friendly error message
  const message = handleApiError(error);
  showErrorToast(message);
}
```

### Group Expense Calculations
```typescript
import { calculateItemAmount, calculateGrandTotal, safeParseNumber } from '../utils/groupExpense';

// Safe item amount calculation with validation
const item = { name: 'Coffee', amount: '5.50', quantity: 2 };
const itemTotal = calculateItemAmount(item); // 11.00

// Handles edge cases gracefully
const invalidItem = { name: 'Invalid', amount: 'abc', quantity: 1 };
const safeTotal = calculateItemAmount(invalidItem); // 0

// Safe number parsing
const validAmount = safeParseNumber('123.45'); // 123.45
const invalidAmount = safeParseNumber('abc', 0); // 0

const total = calculateGrandTotal(items, fees);
```

### API Error Handling
```typescript
import { handleApiError, retryWithBackoff } from '../utils/api';

try {
  await apiCall();
} catch (error) {
  const message = handleApiError(error);
  setError(message);
}

// With retry
const result = await retryWithBackoff(() => apiCall(), 3, 1000);
```

### UI Helpers
```typescript
import { truncateText, debounce, classNames } from '../utils/ui';

const shortText = truncateText(longDescription, 50);
const debouncedSearch = debounce(searchFunction, 300);
const buttonClass = classNames(
  'btn',
  isActive && 'btn-active',
  isDisabled && 'btn-disabled'
);
```

## 🔄 Migration Guide

If you have existing code that duplicates these utilities, here's how to migrate:

### Before:
```typescript
// Duplicated currency formatting
const formatCurrency = (amount: string) => {
  const numAmount = parseFloat(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(numAmount);
};
```

### After:
```typescript
import { formatCurrency } from '../utils/currency';
// Use directly: formatCurrency(amount)
```

### Before:
```typescript
// Manual validation
if (!description.trim()) {
  setError('Description is required');
  return;
}
```

### After:
```typescript
import { validateRequired } from '../utils/form';

const error = validateRequired(description, 'Description');
if (error) {
  setError(error);
  return;
}
```

## 🧪 Testing

These utilities are designed to be pure functions (where possible) making them easy to test:

```typescript
import { calculateGrandTotal, validateRequired } from '../utils';

describe('Group Expense Utils', () => {
  test('calculateGrandTotal', () => {
    const items = [{ name: 'Item', amount: '100', quantity: 2 }];
    const fees = [{ name: 'Fee', amount: '10' }];
    expect(calculateGrandTotal(items, fees)).toBe(210);
  });
});

describe('Form Utils', () => {
  test('validateRequired', () => {
    expect(validateRequired('', 'Name')).toBe('Name is required');
    expect(validateRequired('John', 'Name')).toBe(null);
  });
});
```

## 🚀 Benefits

1. **Consistency** - Same logic used across components
2. **Maintainability** - Single place to update shared logic
3. **Testability** - Pure functions are easy to test
4. **Type Safety** - Full TypeScript support
5. **Tree Shaking** - Import only what you need
6. **Documentation** - Well-documented with examples
7. **Error Handling** - Consistent error handling patterns

## 📝 Contributing

When adding new utilities:

1. Choose the appropriate file or create a new one
2. Add proper TypeScript types
3. Include JSDoc comments
4. Add examples in this README
5. Consider edge cases and error handling
6. Keep functions pure when possible
7. Export from `index.ts` for convenience
