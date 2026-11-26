import { ApiError } from "./types";
import { session, SESSION_EXPIRED_ERROR } from "./session";
import config from "@/config/config";

const API_BASE_URL = config.API_BASE_URL;

// One-time migration: remove old tokens from localStorage
if (globalThis.localStorage) {
  localStorage.removeItem("authToken");
  localStorage.removeItem("refreshToken");
}

// A rejected `fetch()` (offline, DNS failure, connection refused, CORS
// preflight failure, ...) never produces an HTTP response at all, so there's
// no status/body for parseErrorResponse to read - it's a distinct failure
// mode from a real HTTP error response, marked here rather than left to leak
// the browser's own Error.message text through an accidental property read.
const NETWORK_ERROR: ApiError = {
  type: "about:blank",
  title: "Network Error",
  isNetworkError: true,
};

async function fetchOrThrowNetworkError(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw NETWORK_ERROR;
  }
}

// Backend error responses (see ungerr's errorBody / Huma's ErrorModel) are
// shaped as `{ title, status, detail, errors }` — parsed here as close to
// verbatim as possible and handed back as an ApiError. Turning this into a
// user-facing display string (per-field `errors[].message` vs. the single
// `detail` string vs. a generic 5xx message) is display logic, not parsing
// logic, so it lives in errors.ts's `getApiErrorMessage`, called by callers
// that actually need a string to show rather than baked in here.
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  const body: Partial<ApiError> = await response.json().catch(() => ({}));

  return {
    type: "about:blank",
    ...body,
    status: response.status,
  };
}

class ApiClient {
  private refresh: { generation: number; promise: Promise<void> } | null = null;
  private refreshVersion = 0;
  private logoutRequest: Promise<unknown> | null = null;
  private cookieTransport: Promise<Response> | null = null;

  private cookieFetch(url: string, init: RequestInit, generation: number, logout = false) {
    const send = () => {
      if (!logout) session.check(generation);
      return fetchOrThrowNetworkError(url, init);
    };
    // Keep the real transport, not a generation-cancelled promise: headers can set cookies.
    const request = this.cookieTransport ? this.cookieTransport.catch(() => {}).then(send) : send();
    this.cookieTransport = request;
    const clear = () => { if (this.cookieTransport === request) this.cookieTransport = null; };
    request.then(clear, clear);
    return request;
  }
  constructor(private readonly baseUrl: string) {}

  private refreshSession(generation: number, forLogout = false): Promise<void> {
    if (this.logoutRequest && !forLogout) {
      return session.guard(generation, this.logoutRequest.catch(() => {}).then(() => {
        session.check(generation);
        return this.refreshSession(generation);
      }));
    }
    if (this.refresh?.generation === generation) return this.refresh.promise;
    const promise = session.guard(generation, (async () => {
      const response = await this.cookieFetch(`${this.baseUrl}/auth/refresh`, {
        method: "PUT", credentials: "include",
      }, generation);
      session.check(generation);
      if (response.status === 401 && !this.logoutRequest) {
        session.change("expired");
        throw SESSION_EXPIRED_ERROR;
      }
      if (!response.ok) throw await parseErrorResponse(response);
      const body = await response.json();
      session.check(generation);
      const token = body?.data?.csrfToken ?? body?.csrfToken;
      if (token) session.adopt(token, generation);
      this.refreshVersion++;
    })());
    this.refresh = { generation, promise };
    const clear = () => { if (this.refresh?.promise === promise) this.refresh = null; };
    promise.then(clear, clear);
    return promise;
  }

  private request<T>(endpoint: string, options: RequestInit = {}, isRetry = false,
    generation = session.read().generation): Promise<T> {
    if (endpoint === "/auth/logout") {
      // Wait for the HTTP response: generation cancellation cannot cancel Set-Cookie.
      const request = this.send<T>(endpoint, options, isRetry, generation);
      this.logoutRequest = request;
      const clear = () => { if (this.logoutRequest === request) this.logoutRequest = null; };
      request.then(clear, clear);
      return request;
    }
    return session.guard(generation, this.send<T>(endpoint, options, isRetry, generation));
  }

  private async send<T>(endpoint: string, options: RequestInit, isRetry: boolean,
    generation: number): Promise<T> {
    session.check(generation);
    const logout = endpoint === "/auth/logout";
    // Public credentials never refresh; logout can refresh but remains usable after expiry.
    const protectedRequest = !endpoint.startsWith("/auth/");
    if (protectedRequest && session.read().status === "expired") throw SESSION_EXPIRED_ERROR;
    const token = session.token();
    const refreshVersion = this.refreshVersion;
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token && options.method !== "GET" && options.method !== "HEAD") {
      headers.set("X-CSRF-Token", token);
    }
    const init: RequestInit = { ...options, headers, credentials: "include" };
    const changesCookies = /^\/auth\/(login|refresh|logout|reset-password|verify-registration|[^/]+\/callback)(\?|$)/.test(endpoint);
    const response = await (changesCookies
      ? this.cookieFetch(`${this.baseUrl}${endpoint}`, init, generation, logout)
      : fetchOrThrowNetworkError(`${this.baseUrl}${endpoint}`, init));
    if (!logout) session.check(generation);
    if (response.status === 401 && (protectedRequest || logout) && !isRetry &&
      generation === session.read().generation) {
      // A late 401 can arrive after another request already refreshed the token.
      if (this.refreshVersion === refreshVersion) await this.refreshSession(generation, logout);
      session.check(generation);
      return this.request<T>(endpoint, options, true, generation);
    }
    if (!response.ok) throw await parseErrorResponse(response);
    if (response.status === 204) {
      // SAFETY: 204 endpoints use void-compatible result types and have no body.
      return {} as T;
    }
    const data = await response.json();
    if (!logout) session.check(generation);
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

  post<T, D = unknown>(endpoint: string, data?: D, headers?: HeadersInit) {
    return this.request<T>(endpoint, {
      headers,
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

  delete<T>(endpoint: string, options: RequestInit = {}) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  uploadFile<T>(endpoint: string, formData: FormData, isRetry = false): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body: formData }, isRetry);
  }
}

export const apiClient = new ApiClient(API_BASE_URL + "/v1");
