import { useRef, useState, type FormEventHandler } from "react";
import { Link } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import config from "@/config/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, ArrowLeft, Check } from "lucide-react";
import { useForgotPassword } from "@/hooks/useApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [waitingForCaptcha, setWaitingForCaptcha] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const pendingSubmit = useRef(false);
  const { toast } = useToast();
  const {
    mutate: forgotPassword,
    isPending: isLoading,
    isSuccess,
  } = useForgotPassword();

  const submit = (token: string) => {
    setWaitingForCaptcha(false);
    forgotPassword({ email, captchaToken: token }, {
      onSuccess: () => {
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      },
      onError: (error: unknown) => {
        const err = error as { message?: string };
        toast({
          variant: "destructive",
          title: "Request failed",
          description: err.message || "Something went wrong",
        });
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      },
    });
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (captchaToken) {
      submit(captchaToken);
    } else if (config.TURNSTILE_SITE_KEY) {
      pendingSubmit.current = true;
      setWaitingForCaptcha(true);
    } else {
      forgotPassword({ email, captchaToken: "" }, {
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Request failed",
            description: err.message || "Something went wrong",
          });
        },
      });
    }
  };

  const handleCaptchaSuccess = (token: string) => {
    setCaptchaToken(token);
    if (pendingSubmit.current) {
      pendingSubmit.current = false;
      submit(token);
    }
  };

  const isBusy = isLoading || waitingForCaptcha;

  if (isSuccess) {
    return (
      <div className="animate-fade-up">
        <Card className="border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-display font-semibold mb-2">
              Check your email
            </h2>
            <p className="text-muted-foreground mb-6">
              If an account exists for <strong>{email}</strong>, you'll receive
              a password reset link shortly.
            </p>
            <Link to="/login">
              <Button className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <Card className="border-border/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-display">
            Forgot password?
          </CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            {config.TURNSTILE_SITE_KEY && (
              <Turnstile
                ref={turnstileRef}
                siteKey={config.TURNSTILE_SITE_KEY}
                onSuccess={handleCaptchaSuccess}
                onExpire={() => setCaptchaToken(null)}
                onError={() => {
                  setCaptchaToken(null);
                  setWaitingForCaptcha(false);
                  pendingSubmit.current = false;
                  toast({ variant: "destructive", title: "Captcha failed", description: "Please try again" });
                }}
                options={{ size: "invisible" }}
              />
            )}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isBusy}
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
