/**
 * API-related utility functions
 */

import type { ApiError } from "../types/api";

/**
 * Type guard to check if an error is an ApiError
 */
export const isApiError = (error: unknown): error is ApiError => {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as any).message === "string"
  );
};

/**
 * Handle API errors consistently with proper typing
 */
export const handleApiError = (error: unknown): string => {
  // Ensure we're working with a proper error object
  if (!isApiError(error)) {
    return "An unexpected error occurred";
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
        return "Bad request. Please check your input.";
      case 401:
        return "You are not authorized. Please log in again.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 409:
        return "There was a conflict with your request.";
      case 422:
        return "The data you provided is invalid.";
      case 429:
        return "Too many requests. Please try again later.";
      case 500:
        return "Internal server error. Please try again later.";
      case 502:
        return "Bad gateway. The server is temporarily unavailable.";
      case 503:
        return "Service unavailable. Please try again later.";
      default:
        return `Request failed with status ${error.response.status}`;
    }
  }

  return "An unexpected error occurred";
};
