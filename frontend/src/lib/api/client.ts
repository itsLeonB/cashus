import { ApiError } from "./types";
import config from "@/config/config";

const API_BASE_URL = config.API_BASE_URL;

// One-time migration: remove old tokens from localStorage
if (typeof localStorage !== "undefined") {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
}

const CSRF_STORAGE_KEY = "csrfToken";

const SESSION_EXPIRED_ERROR: ApiError = {
  message: "Session expired",
  statusCode: 401,
  isRefreshFailure: true,
};

async function parseErrorResponse(response: Response): Promise<ApiError> {
  const error: ApiError = await response.json().catch(() => ({
    message: "An unexpected error occurred",
    statusCode: response.status,
  }));

  if (!error.message && error.errors?.[0]?.detail) {
    error.message = error.errors[0].detail;
  }
  if (!error.statusCode) {
    error.statusCode = response.status;
  }

  return error;
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

    const headers: HeadersInit = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    if (method !== "GET" && method !== "HEAD") {
      const csrf = this.getCsrfToken();
      if (csrf) {
        (headers as Record<string, string>)["X-CSRF-Token"] = csrf;
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
      return {} as T;
    }

    const data = await response.json();
    return data && typeof data === "object" && "data" in data ? data.data : data;
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

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown) {
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
    return data && typeof data === "object" && "data" in data ? data.data : data;
  }
}

export const apiClient = new ApiClient(API_BASE_URL + "/v1");
