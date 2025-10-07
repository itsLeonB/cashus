import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../services/api";

const VerifyRegistration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setError("Verification token is missing");
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.verifyRegistration(token);
        await login(response.token);
        navigate("/dashboard", { replace: true });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Verification failed";
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [searchParams, login, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate("/login")}
          className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default VerifyRegistration;
