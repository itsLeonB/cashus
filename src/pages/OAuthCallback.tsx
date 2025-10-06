import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../services/api";

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        navigate("/login");
        return;
      }

      try {
        const response = await apiClient.handleOAuthCallback(
          "google",
          code,
          state
        );
        await login(response.token);
        navigate("/dashboard");
      } catch (err) {
        console.error("OAuth callback error:", err);
        navigate("/login");
      }
    };

    handleCallback();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
