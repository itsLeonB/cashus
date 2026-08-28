import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useVerifyRegistration } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const { mutate: verifyRegistration } = useVerifyRegistration();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token");
      return;
    }

    verifyRegistration(token, {
      onSuccess: (response) => {
        setStatus("success");
        setMessage(
          response.message || "Your email has been verified successfully!",
        );
        timeoutId = setTimeout(() => navigate("/login"), 3000);
      },
      onError: (error: unknown) => {
        const err = error as { message?: string };
        setStatus("error");
        setMessage(
          err.message || "Verification failed. The token may have expired.",
        );
      },
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, navigate, verifyRegistration]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">
            Email Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <p className="text-foreground font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to login...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-foreground font-medium">{message}</p>
              <Link to="/login">
                <Button>Go to Login</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
