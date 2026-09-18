import type { ApiError } from "./types";

export const DEFAULT_ERROR_MESSAGE = "Something went wrong";

const SERVER_ERROR_MESSAGE =
  "Something went wrong on our end. Please contact the developer if this keeps happening.";

/**
 * Computes a user-facing message from an error caught after an API call
 * (a mutation's `onError`, or a `catch` after `mutateAsync` — `catch`
 * bindings are always typed `unknown`, so this centralizes the one
 * assertion needed to treat it as ApiError-shaped).
 *
 * Backend error responses (see ungerr's errorBody / Huma's ErrorModel) are
 * shaped as `{ title, status, detail, errors }`, not `{ message }`, so
 * there's no field to just read — the message has to be computed: a 5xx
 * status always shows a generic contact-the-developer message (never the
 * raw `detail`, which may be an internal error string); otherwise per-field
 * validation messages (`errors[].message`) take priority over the single
 * `detail` string; and `fallback` is used if neither is present.
 */
export function getApiErrorMessage<E = unknown>(
  error: E,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): string {
  // SAFETY: apiClient (see client.ts) only ever throws/rejects with
  // ApiError-shaped objects, so a value caught from an API call is safe to
  // treat as ApiError here.
  const apiError = error as ApiError;

  if (apiError?.status && apiError.status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  const fieldMessages = apiError?.errors
    ?.map((e) => e.message)
    .filter((m): m is string => !!m);
  if (fieldMessages?.length) {
    return fieldMessages.join("; ");
  }

  return apiError?.detail || fallback;
}
