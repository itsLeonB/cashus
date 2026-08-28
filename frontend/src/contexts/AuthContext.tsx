import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile, authApi, apiClient, ApiError } from "@/lib/api";
import { clearNotificationContext } from "@/lib/notificationPersistence";
import { clearServiceWorkerCache } from "@/lib/sw-utils";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirmation: string,
    slug?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isRefreshFailed: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshFailed, setIsRefreshFailed] = useState(false);
  const queryClient = useQueryClient();

  const refreshUser = useCallback(async () => {
    try {
      if (apiClient.isRefreshFailed()) {
        setIsRefreshFailed(true);
        setUser(null);
        return;
      }

      const profile = await authApi.getProfile();
      setUser(profile);
      setIsRefreshFailed(false);
    } catch (error) {
      const err = error as ApiError;
      if (err.isRefreshFailure) {
        setIsRefreshFailed(true);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (apiClient.hasSession()) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const resp = await authApi.login({ email, password });
      apiClient.setCsrfToken(resp.csrfToken);
      apiClient.resetRefreshState();

      clearServiceWorkerCache().catch((error) => {
        console.error("Failed to clear service worker cache:", error);
      });

      queryClient.clear();

      globalThis.location.replace("/dashboard");
      // Block React from returning — prevents SPA navigation before browser reloads
      await new Promise(() => {});
    },
    [queryClient],
  );

  const register = useCallback(
    async (email: string, password: string, passwordConfirmation: string, slug?: string) => {
      await authApi.register({ email, password, passwordConfirmation, slug });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout API failed (swallowed):", error);
    } finally {
      apiClient.clearCsrfToken();
      clearNotificationContext();
      queryClient.clear();

      clearServiceWorkerCache().catch((error) => {
        console.error("Failed to clear service worker cache:", error);
      });

      globalThis.location.replace("/login");
      // Block React from returning — prevents SPA navigation before browser reloads
      await new Promise(() => {});
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
      isRefreshFailed,
    }),
    [user, isLoading, login, register, logout, refreshUser, isRefreshFailed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
