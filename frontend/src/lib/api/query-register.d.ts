import "@tanstack/react-query";

import type { ApiError } from "./types";

// Registers `ApiError` as the default error type for every TanStack Query
// hook in the app. `apiClient` (see client.ts) only ever throws/rejects with
// `ApiError`-shaped objects, so query/mutation error callbacks can rely on
// that shape without an explicit type parameter or runtime assertion at
// every call site.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}
