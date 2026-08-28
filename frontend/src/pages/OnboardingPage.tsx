import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CircleDollarSign, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CurrencySelect } from "@/components/CurrencySelect";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUpdateProfile } from "@/hooks/useApi";
import { profileSchema } from "@/lib/validations/profile";

export default function OnboardingPage() {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const [name, setName] = useState(user?.name || "");
  const [homeCurrency, setHomeCurrency] = useState("");
  const [errors, setErrors] = useState({ name: "", homeCurrency: "" });

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Seo noindex />
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.isOnboarded) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = profileSchema.safeParse({ name, homeCurrency });

    if (!result.success) {
      setErrors({
        name:
          result.error.issues.find((issue) => issue.path[0] === "name")
            ?.message || "",
        homeCurrency:
          result.error.issues.find((issue) => issue.path[0] === "homeCurrency")
            ?.message || "",
      });
      return;
    }

    updateProfile(result.data, {
      onSuccess: () => {
        refreshUser()
          .catch(() => {
            // Even if refresh fails, the profile was saved; let the guard
            // re-evaluate on next navigation.
          })
          .finally(() => navigate("/dashboard", { replace: true }));
      },
      onError: (error: unknown) => {
        const err = error as { message?: string };
        toast({
          variant: "destructive",
          title: "Could not finish setup",
          description: err.message || "Please try again.",
        });
      },
    });
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-8 flex items-center justify-center">
      <Seo noindex />
      <div className="w-full max-w-md space-y-6 animate-fade-up">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Set up your profile</CardTitle>
            <CardDescription>
              Choose your display name and home currency to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label
                  htmlFor="onboarding-name"
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Display Name
                </Label>
                <Input
                  id="onboarding-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setErrors((current) => ({ ...current, name: "" }));
                  }}
                  placeholder="Enter your name"
                  disabled={isPending}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="onboarding-home-currency"
                  className="flex items-center gap-2"
                >
                  <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                  Home Currency
                </Label>
                <CurrencySelect
                  id="onboarding-home-currency"
                  value={homeCurrency}
                  onChange={(value) => {
                    setHomeCurrency(value);
                    setErrors((current) => ({ ...current, homeCurrency: "" }));
                  }}
                  placeholder="Select home currency"
                  disabled={isPending}
                />
                {errors.homeCurrency && (
                  <p className="text-xs text-destructive">
                    {errors.homeCurrency}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
