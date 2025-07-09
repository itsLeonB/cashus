/**
 * Generic form validation utilities
 */

/**
 * Check if a string field is empty or only whitespace
 */
export const isEmpty = (value: string): boolean => {
  return !value || value.trim().length === 0;
};

/**
 * Validate a required string field
 */
export const validateRequired = (value: string, fieldName: string): string | null => {
  if (isEmpty(value)) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validate a numeric field
 */
export const validateNumeric = (
  value: string | number, 
  fieldName: string, 
  options: {
    min?: number;
    max?: number;
    required?: boolean;
  } = {}
): string | null => {
  const { min, max, required = true } = options;
  
  if (required && (value === '' || value === null || value === undefined)) {
    return `${fieldName} is required`;
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || !Number.isFinite(numValue)) {
    return `${fieldName} must be a valid number`;
  }
  
  if (min !== undefined && numValue < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  if (max !== undefined && numValue > max) {
    return `${fieldName} must be at most ${max}`;
  }
  
  return null;
};

/**
 * Validate an integer field
 */
export const validateInteger = (
  value: string | number,
  fieldName: string,
  options: {
    min?: number;
    max?: number;
    required?: boolean;
  } = {}
): string | null => {
  const numericError = validateNumeric(value, fieldName, options);
  if (numericError) return numericError;
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (!Number.isInteger(numValue)) {
    return `${fieldName} must be a whole number`;
  }
  
  return null;
};

/**
 * Validate an email address
 */
export const validateEmail = (email: string): string | null => {
  if (isEmpty(email)) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
};

/**
 * Validate a password
 */
export const validatePassword = (
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): string | null => {
  const {
    minLength = 8,
    requireUppercase = false,
    requireLowercase = false,
    requireNumbers = false,
    requireSpecialChars = false
  } = options;
  
  if (isEmpty(password)) {
    return 'Password is required';
  }
  
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  
  if (requireNumbers && !/\d/.test(password)) {
    return 'Password must contain at least one number';
  }
  
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  
  return null;
};

/**
 * Sanitize a string by trimming whitespace and removing extra spaces
 */
export const sanitizeString = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};

/**
 * Format a number input value (remove non-numeric characters except decimal point)
 */
export const formatNumberInput = (value: string): string => {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
};

/**
 * Format an integer input value (remove all non-numeric characters)
 */
export const formatIntegerInput = (value: string): string => {
  return value.replace(/[^0-9]/g, '');
};
