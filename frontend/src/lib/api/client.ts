import { ApiError, ValidationError } from "./types";
import { DEFAULT_ERROR_MESSAGE } from "./errors";
import config from "@/config/config";

const API_BASE_URL = config.API_BASE_URL;

// One-time migration: remove old tokens from localStorage
if (globalThis.localStorage) {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
}

const CSRF_STORAGE_KEY = "csrfToken";

const SESSION_EXPIRED_ERROR: ApiError = {
  message: "Session expired",
  statusCode: 401,
  isRefreshFailure: true,
};

const SERVER_ERROR_MESSAGE =
  "Something went wrong on our end. Please contact the developer if this keeps happening.";

// Backend error responses (see ungerr's errorBody / Huma's ErrorModel) are
// shaped as `{ title, status, detail, errors }`, not `{ message }` — so the
// user-facing message has to be extracted from `detail` (a single business
// error) or `errors[].message` (per-field request validation errors), never
// read directly off a `message` property that the backend never sends.
function extractBackendMessage(body: {
  detail?: string;
  errors?: ValidationError[];
}): string | undefined {
  const fieldMessages = body.errors
    ?.map((e) => e.message)
    .filter((m): m is string => !!m);
  if (fieldMessages?.length) {
    return fieldMessages.join("; ");
  }

  return body.detail || undefined;
}

export async function parseErrorResponse(response: Response): Promise<ApiError> {
  const body: { title?: string; detail?: string; errors?: ValidationError[] } =
    await response.json().catch(() => ({}));

  const message =
    response.status >= 500
      ? SERVER_ERROR_MESSAGE
      : extractBackendMessage(body) || DEFAULT_ERROR_MESSAGE;

  return {
    ...body,
    message,
    statusCode: response.status,
  };
}

class ApiClient {
  private readonly baseUrl: string;
  private isRefreshing = false;
  private refreshFailed = false;
  private refreshSubscribers: {
    resolve: () => void;
    reject: (e: ApiError) => void;
  }[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCsrfToken(): string | null {
    return localStorage.getItem(CSRF_STORAGE_KEY);
  }

  setCsrfToken(token: string) {
    localStorage.setItem(CSRF_STORAGE_KEY, token);
  }

  clearCsrfToken() {
    localStorage.removeItem(CSRF_STORAGE_KEY);
  }

  hasSession(): boolean {
    return this.getCsrfToken() !== null;
  }

  isRefreshFailed() {
    return this.refreshFailed;
  }

  resetRefreshState() {
    this.refreshFailed = false;
  }

  private notifySubscribersSuccess() {
    this.refreshSubscribers.forEach((s) => s.resolve());
    this.refreshSubscribers = [];
  }

  private notifySubscribersFailure() {
    this.refreshSubscribers.forEach((s) =>
      s.reject(SESSION_EXPIRED_ERROR),
    );
    this.refreshSubscribers = [];
  }

  private async handleRefreshFlow<T>(
    retryAction: () => Promise<T>,
  ): Promise<T> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "PUT",
          credentials: "include",
        });

        if (!refreshResponse.ok) {
          this.refreshFailed = true;
          this.clearCsrfToken();
          throw new Error("Refresh failed");
        }

        const data = await refreshResponse.json();
        const csrfToken = data?.data?.csrfToken ?? data?.csrfToken;
        if (csrfToken) {
          this.setCsrfToken(csrfToken);
        }

        this.isRefreshing = false;
        this.notifySubscribersSuccess();
        return retryAction();
      } catch (error) {
        this.refreshFailed = true;
        this.isRefreshing = false;
        this.notifySubscribersFailure();
        console.error("Token refresh failed:", error);
        throw SESSION_EXPIRED_ERROR;
      }
    }

    return new Promise<T>((resolve, reject) => {
      this.refreshSubscribers.push({
        resolve: () => { retryAction().then(resolve).catch(reject); },
        reject,
      });
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    if (this.refreshFailed) {
      throw SESSION_EXPIRED_ERROR;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || "GET";

    const headers: HeadersInit = {};
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    if (options.headers) {
      // Merged after the default above so a caller-supplied header (e.g. a
      // custom Content-Type) overrides it, matching fetch's usual semantics.
      Object.assign(headers, options.headers);
    }

    if (method !== "GET" && method !== "HEAD") {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401 && !isRetry) {
      return this.handleRefreshFlow(() =>
        this.request<T>(endpoint, options, true),
      );
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    if (response.status === 204) {
      // SAFETY: HTTP 204 responses have no body. Callers of endpoints that
      // return 204 type T as void/undefined-compatible, so an empty object
      // is a safe stand-in for "no data".
      return {} as T;
    }

    const data = await response.json();
    return data && data instanceof Object && "data" in data ? data.data : data;
  }

  get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | null | undefined>,
  ) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return this.request<T>(url, { method: "GET" });
  }

  post<T, D = unknown>(endpoint: string, data?: D) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T, D = unknown>(endpoint: string, data?: D) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T, D = unknown>(endpoint: string, data?: D) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async uploadFile<T>(
    endpoint: string,
    formData: FormData,
    isRetry = false,
  ): Promise<T> {
    if (this.refreshFailed) {
      throw SESSION_EXPIRED_ERROR;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {};
    const csrf = this.getCsrfToken();
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });

    if (response.status === 401 && !isRetry) {
      return this.handleRefreshFlow(() =>
        this.uploadFile<T>(endpoint, formData, true),
      );
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = await response.json();
    return data && data instanceof Object && "data" in data ? data.data : data;
  }
}

export const apiClient = new ApiClient(API_BASE_URL + "/v1");
