import { apiClient } from "./client";
import { session } from "./session";
import config from "@/config/config";
import {
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserProfile,
} from "./types";

export interface UpdateProfileRequest {
  name: string;
  homeCurrency: string;
}

interface AuthResponse {
  message: string;
  csrfToken: string;
}

let pendingLogout: Promise<unknown> | null = null;

async function authenticate(action: () => Promise<AuthResponse>) {
  if (pendingLogout) await pendingLogout.catch(() => {});
  const generation = session.change();
  const response = await action();
  session.check(generation);
  if (response.csrfToken) session.adopt(response.csrfToken, generation);
  return response;
}

export const authApi = {
  login: (data: LoginRequest) => authenticate(() => apiClient.post<AuthResponse>("/auth/login", data)),
  register: (data: RegisterRequest) => apiClient.post<{ message: string }>("/auth/register", data),
  verifyRegistration: (token: string) => authenticate(() =>
    apiClient.get<AuthResponse>(`/auth/verify-registration?token=${encodeURIComponent(token)}`)),
  refreshToken: async () => {
    const generation = session.read().generation;
    if (pendingLogout) await pendingLogout.catch(() => {});
    session.check(generation);
    try {
      const response = await apiClient.put<AuthResponse>("/auth/refresh");
      if (response.csrfToken) session.adopt(response.csrfToken, generation);
      return response;
    } catch (error) {
      if (!pendingLogout && generation === session.read().generation && error?.status === 401) session.change("expired");
      throw error;
    }
  },
  forgotPassword: (email: string, captchaToken: string) =>
    apiClient.post<{ message: string }>("/auth/password-reset", { email, captchaToken }),
  resetPassword: async (data: ResetPasswordRequest) => {
    if (pendingLogout) await pendingLogout.catch(() => {});
    const generation = session.read().generation;
    const response = await apiClient.patch<AuthResponse>("/auth/reset-password", data);
    session.check(generation);
    if (response.csrfToken) session.adopt(response.csrfToken, session.change());
    return response;
  },
  getProfile: () => apiClient.get<UserProfile>("/profile"),
  updateProfile: (data: UpdateProfileRequest) => apiClient.patch<UserProfile>("/profile", data),
  logout: () => {
    if (pendingLogout) return pendingLogout;
    const token = session.token();
    const generation = session.read().generation;
    session.clearToken();
    const request = apiClient.delete("/auth/logout", {
      headers: token ? { "X-CSRF-Token": token } : {},
    }).then((response) => {
      if (generation === session.read().generation) session.change();
      return response;
    }, (error) => {
      if (generation === session.read().generation && token && !session.token()) {
        session.adopt(token, generation);
      }
      throw error;
    });
    pendingLogout = request;
    const clear = () => { if (pendingLogout === request) pendingLogout = null; };
    request.then(clear, clear);
    return request;
  },
  getOAuthUrl: (provider: string) => `${config.API_BASE_URL}/v1/auth/${provider}`,
  handleOAuthCallback: (provider: string, code: string, state: string | null) => authenticate(() =>
    apiClient.get<AuthResponse>(`/auth/${provider}/callback`, { code, state })),
};
