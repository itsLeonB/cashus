/**
 * API-related utility functions
 */

import { toast } from "react-toastify";
import type { ApiError } from '../types/api';

/**
 * Type guard to check if an error is an ApiError
 */
export const isApiError = (error: unknown): error is ApiError => {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
};

/**
 * Handle API errors consistently with proper typing
 */
export const handleApiError = (error: unknown): string => {
  // Ensure we're working with a proper error object
  if (!isApiError(error)) {
    return 'An unexpected error occurred';
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.response?.status) {
    switch (error.response.status) {
      case 400:
        return 'Bad request. Please check your input.';
      case 401:
        return 'You are not authorized. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'There was a conflict with your request.';
      case 422:
        return 'The data you provided is invalid.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 502:
        return 'Bad gateway. The server is temporarily unavailable.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        return `Request failed with status ${error.response.status}`;
    }
  }
  
  return 'An unexpected error occurred';
};

/**
 * Check if an error is a network error (no response received)
 * Network errors occur when the request was made but no response was received
 */
export const isNetworkError = (error: unknown): error is ApiError => {
  return isApiError(error) && !error.response && !!error.request;
};

/**
 * Check if an error is an authentication error (401 Unauthorized)
 * Authentication errors indicate invalid or expired credentials
 */
export const isAuthError = (error: unknown): error is ApiError => {
  return isApiError(error) && error.response?.status === 401;
};

/**
 * Check if an error is a validation error (400 Bad Request or 422 Unprocessable Entity)
 * Validation errors indicate invalid input data or business rule violations
 */
export const isValidationError = (error: unknown): error is ApiError => {
  return (
    isApiError(error) && 
    (error.response?.status === 422 || error.response?.status === 400)
  );
};

/**
 * Check if an error is a client error (4xx status codes)
 * Client errors indicate issues with the request that should not be retried
 */
export const isClientError = (error: unknown): error is ApiError => {
  return (
    isApiError(error) && 
    error.response?.status !== undefined &&
    error.response.status >= 400 && 
    error.response.status < 500
  );
};

/**
 * Check if an error is a server error (5xx status codes)
 * Server errors indicate issues on the server side that might be temporary
 */
export const isServerError = (error: unknown): error is ApiError => {
  return (
    isApiError(error) && 
    error.response?.status !== undefined &&
    error.response.status >= 500 && 
    error.response.status < 600
  );
};

/**
 * Check if an error is retryable (network errors or server errors)
 * Retryable errors are those that might succeed if attempted again
 */
export const isRetryableError = (error: unknown): error is ApiError => {
  return isNetworkError(error) || isServerError(error);
};

/**
 * Retry an async function with exponential backoff
 */
/**
 * Retry a function with exponential backoff strategy
 * Automatically skips retry for client errors (4xx) that shouldn't be retried
 * 
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 1000)
 * @returns Promise that resolves with the function result or rejects with the last error
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetch('/api/data').then(r => r.json()),
 *   3,
 *   1000
 * );
 * ```
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) - these indicate issues with the request
      // that won't be resolved by retrying
      if (isClientError(error)) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Only retry on network errors or server errors (5xx)
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
      const delay = baseDelay * Math.pow(2, attempt) + jitter;
      
      toast.info(`Retrying request (${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Ensure we always throw an error if we reach this point
  if (lastError !== undefined) {
    throw lastError;
  }
  
  // This should never happen, but provides a fallback
  throw new Error('Retry failed: No error captured');
};

/**
 * Create a timeout promise
 */
export const createTimeoutPromise = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
};

/**
 * Add timeout to a promise
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([promise, createTimeoutPromise(ms)]);
};

/**
 * Batch API requests with concurrency limit
 */
export const batchRequests = async <T, R>(
  items: T[],
  requestFn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(requestFn);
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
};

/**
 * Create a cache for API responses
 */
export class ApiCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttl: number;
  
  constructor(ttlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.ttl = ttlMs;
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

/**
 * Create a debounced API call function
 */
export const createDebouncedApiCall = <T extends any[], R>(
  apiCall: (...args: T) => Promise<R>,
  delay: number = 300
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  let latestResolve: ((value: R) => void) | null = null;
  let latestReject: ((reason: unknown) => void) | null = null;
  
  return (...args: T): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      // Cancel previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Reject previous promise if it exists
      if (latestReject) {
        latestReject(new Error('Debounced'));
      }
      
      latestResolve = resolve;
      latestReject = reject;
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await apiCall(...args);
          if (latestResolve === resolve) {
            resolve(result);
          }
        } catch (error) {
          if (latestReject === reject) {
            reject(error);
          }
        }
      }, delay);
    });
  };
};
