import { lazy, Suspense } from "react";
import flagsmith from "@flagsmith/flagsmith";
import { FlagsmithProvider } from "@flagsmith/flagsmith/react";
import config from "@/config/config";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { FaroRoutes } from "@grafana/faro-react";

import { Spinner } from "@/components/ui/spinner";
import { useUserJotTracker } from "@/hooks/useUserJotTracker";
import { useNotificationIntent } from "@/hooks/useNotificationIntent";

import { AuthLayout } from "@/layouts/AuthLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { subscriptionPurchaseEnabled } from "@/lib/flags";

import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/DashboardPage";

// Lazy load other pages
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
const VerifyRegistrationPage = lazy(
  () => import("@/pages/auth/VerifyRegistrationPage"),
);
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const OAuthCallbackPage = lazy(() => import("@/pages/auth/OAuthCallbackPage"));
const FriendsPage = lazy(() => import("@/pages/FriendsPage"));
const FriendDetailPage = lazy(() => import("@/pages/FriendDetailPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const ExpenseDetailPage = lazy(() => import("@/pages/ExpenseDetailPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SubscriptionPage = subscriptionPurchaseEnabled
  ? lazy(() => import("@/pages/SubscriptionPage"))
  : () => null;
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PublicFriendPage = lazy(() => import("@/pages/PublicFriendPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const PaymentReturnPage = lazy(() => import("@/pages/PaymentReturnPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const UserJotTracker = () => {
  useUserJotTracker();
  return null;
};

const NotificationIntentTracker = () => {
  useNotificationIntent();
  return null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserJotTracker />
            <NotificationIntentTracker />
            <Suspense
              fallback={
                <div className="h-dvh w-full flex items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <FlagsmithProvider
                options={{
                  environmentID: config.FLAGSMITH_ENVIRONMENT_ID,
                }}
                flagsmith={flagsmith}
              >
                <FaroRoutes>
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPasswordPage />}
                    />
                    <Route
                      path="/auth/verify-registration"
                      element={<VerifyRegistrationPage />}
                    />
                    <Route
                      path="/auth/:provider/callback"
                      element={<OAuthCallbackPage />}
                    />
                  </Route>
                  <Route
                    path="/auth/reset-password"
                    element={<ResetPasswordPage />}
                  />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route element={<OnboardingGuard />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/friends" element={<FriendsPage />} />
                      <Route
                        path="/friends/:friendId"
                        element={<FriendDetailPage />}
                      />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route
                        path="/expenses/:expenseId"
                        element={<ExpenseDetailPage />}
                      />
                      <Route path="/profile" element={<ProfilePage />} />
                      {subscriptionPurchaseEnabled && (
                        <Route
                          path="/subscription"
                          element={<SubscriptionPage />}
                        />
                      )}
                      <Route
                        path="/payment/return"
                        element={<PaymentReturnPage />}
                      />
                    </Route>
                  </Route>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/f/:slug" element={<PublicFriendPage />} />
                  <Route
                    path="/privacy-policy"
                    element={<PrivacyPolicyPage />}
                  />
                  <Route
                    path="/terms-of-service"
                    element={<TermsOfServicePage />}
                  />
                  <Route path="*" element={<NotFound />} />
                </FaroRoutes>
              </FlagsmithProvider>
            </Suspense>
            <Analytics />
            <SpeedInsights />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
