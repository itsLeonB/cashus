import React from "react";

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

interface UnauthenticatedRouteProps {
  children: React.ReactNode;
}

const UnauthenticatedRoute: React.FC<UnauthenticatedRouteProps> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return children;
};

export default UnauthenticatedRoute;
