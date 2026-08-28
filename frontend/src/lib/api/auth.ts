import { apiClient } from "./client";
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

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>("/auth/login", data),

  register: (data: RegisterRequest) =>
    apiClient.post<{ message: string }>("/auth/register", data),

  verifyRegistration: (token: string) =>
    apiClient.get<AuthResponse>(
      `/auth/verify-registration?token=${token}`,
    ),

  refreshToken: () =>
    apiClient.put<AuthResponse>("/auth/refresh"),

  forgotPassword: (email: string, captchaToken: string) =>
    apiClient.post<{ message: string }>("/auth/password-reset", { email, captchaToken }),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.patch<AuthResponse>("/auth/reset-password", data),

  getProfile: () => apiClient.get<UserProfile>("/profile"),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.patch<UserProfile>("/profile", data),

  logout: () => apiClient.delete("/auth/logout"),

  getOAuthUrl: (provider: string) =>
    `${config.API_BASE_URL}/v1/auth/${provider}`,

  handleOAuthCallback: (provider: string, code: string, state: string | null) =>
    apiClient.get<AuthResponse>(`/auth/${provider}/callback`, {
      code,
      state,
    }),
};
