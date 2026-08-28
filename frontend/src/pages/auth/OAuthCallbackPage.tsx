import { useEffect, useState, useRef } from "react";
import { useSearchParams, useParams, Link } from "react-router-dom";
import { useOAuthCallback } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { clearServiceWorkerCache } from "@/lib/sw-utils";
import { apiClient } from "@/lib/api";

export default function OAuthCallbackPage() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const { mutate: handleOAuth, isPending } = useOAuthCallback();

  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!provider) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setError(errorDescription || errorParam || "OAuth authentication failed");
      return;
    }

    if (!code) {
      setError("No authorization code received");
      return;
    }

    if (submittedRef.current) return;
    if (isPending) return;

    submittedRef.current = true;
    handleOAuth(
      { provider, code, state },
      {
        onSuccess: async (data) => {
          apiClient.setCsrfToken(data.csrfToken);
          apiClient.resetRefreshState();
          clearServiceWorkerCache().catch((error) => {
            console.error("Failed to clear service worker cache:", error);
          });
          queryClient.clear();
          globalThis.location.replace("/dashboard");
          await new Promise(() => {});
        },
        onError: (err: unknown) => {
          const error = err as { message?: string };
          setError(error.message || "Failed to complete authentication");
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, searchParams, handleOAuth]);

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50">
          <CardContent className="flex flex-col items-center gap-4 text-center py-8">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-foreground font-medium">Authentication Failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link to="/login">
              <Button>Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardContent className="flex flex-col items-center gap-4 text-center py-8">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Completing authentication...</p>
        </CardContent>
      </Card>
    </div>
  );
}
