import type { ApiError } from "./types";

const DEFAULT_ERROR_MESSAGE = "Something went wrong";

/**
 * Extracts a user-facing message from an error caught after awaiting an API
 * call (e.g. `mutateAsync`). `catch` bindings are always typed `unknown` by
 * TypeScript, so this centralizes the one assertion needed to read `.message`
 * off of it.
 */
export function getApiErrorMessage<E = unknown>(
  error: E,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): string {
  // SAFETY: apiClient (see client.ts) only ever throws/rejects with
  // ApiError-shaped objects, so a value caught from an API call is safe to
  // treat as ApiError here.
  const apiError = error as ApiError;
  return apiError.message || fallback;
}
