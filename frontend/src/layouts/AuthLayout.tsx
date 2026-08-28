import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <Seo noindex />
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Logo size="lg" />

          <div className="space-y-6">
            <h1 className="text-4xl font-display font-bold leading-tight">
              Split expenses.
              <br />
              <span className="text-gradient-primary">Track debts.</span>
              <br />
              Stay friends.
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Cashus makes splitting bills and tracking who owes what
              effortless. No more awkward conversations about money.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Cashus. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size="lg" />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
