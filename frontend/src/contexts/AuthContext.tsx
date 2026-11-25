import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  useRef,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile, authApi } from "@/lib/api";
import { session } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
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
  const snapshot = useSyncExternalStore(session.subscribe, session.read);
  const isRefreshFailed = snapshot.status === "expired";
  const [profileError, setProfileError] = useState<unknown>(null);
  const queryClient = useQueryClient();
  const profileRequest = useRef(0);

  const refreshUser = useCallback(async () => {
    const generation = session.read().generation;
    const request = ++profileRequest.current;
    setProfileError(null);
    try {
      const profile = await authApi.getProfile();
      if (generation === session.read().generation && request === profileRequest.current) setUser(profile);
    } catch (error) {
      if (generation === session.read().generation && request === profileRequest.current) setProfileError(error);
    } finally {
      if (generation === session.read().generation && request === profileRequest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => session.subscribe(() => {
    // Cancel before clearing so late query results cannot restore an old user's data.
    void queryClient.cancelQueries();
    queryClient.clear();
    clearNotificationContext();
    setUser(null);
    setProfileError(null);
  }), [queryClient]);

  useEffect(() => {
    if (snapshot.status === "present") {
      setIsLoading(true);
      void refreshUser();
    } else {
      setIsLoading(false);
    }
    const request = profileRequest.current;
    return () => { if (profileRequest.current === request) profileRequest.current = request + 1; };
  }, [snapshot, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login({ email, password });

      clearServiceWorkerCache().catch((error) => {
        console.error("Failed to clear service worker cache:", error);
      });

      queryClient.clear();

      globalThis.location.replace("/dashboard");
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
    const request = authApi.logout();
    const generation = session.read().generation;
    await request;
    // A confirmed logout advances once; a newer login must not redirect back to /login.
    if (generation + 1 !== session.read().generation || session.read().status !== "anonymous") return;
    clearNotificationContext();
    queryClient.clear();

    clearServiceWorkerCache().catch((error) => {
      console.error("Failed to clear service worker cache:", error);
    });

    globalThis.location.replace("/login");
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

  if (!user && profileError && !isRefreshFailed) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-4">
        <p role="alert"> {getApiErrorMessage(profileError, "Could not load your profile.")} </p>
        <Button disabled={isLoading} onClick={() => { setIsLoading(true); void refreshUser(); }}>Retry</Button>
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
