import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { ProfileResponse } from "../types/api";
import apiClient from "../services/api";

interface AuthContextType {
  profile: ProfileResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!profile && apiClient.isAuthenticated();

  const fetchProfile = async () => {
    try {
      if (apiClient.isAuthenticated()) {
        const profile = await apiClient.getProfile();
        setProfile(profile);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      apiClient.clearAuthToken();
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string) => {
    apiClient.setAuthToken(token);
    await fetchProfile();
  };

  const logout = () => {
    apiClient.clearAuthToken();
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const value: AuthContextType = {
    profile,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
