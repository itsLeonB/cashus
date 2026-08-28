import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import config from "@/config/config";
import { AvatarCircle } from "@/components/AvatarCircle";
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
import {
  useMyTransferMethods,
  useUpdateProfile,
  useForgotPassword,
} from "@/hooks/useApi";
import { AddTransferMethodModal } from "@/components/AddTransferMethodModal";
import { TransferMethodsList } from "@/components/TransferMethodsList";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import {
  User,
  Mail,
  Calendar,
  Edit2,
  Save,
  Loader2,
  LogOut,
  KeyRound,
  Plus,
  Bell,
  CircleDollarSign,
} from "lucide-react";
import { getCurrencyName } from "@/hooks/useCurrencyCodes";
import { CurrencySelect } from "@/components/CurrencySelect";
import { profileSchema } from "@/lib/validations/profile";

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [homeCurrency, setHomeCurrency] = useState(user?.homeCurrency || "");
  const [homeCurrencyError, setHomeCurrencyError] = useState("");
  const [addMethodModalOpen, setAddMethodModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { toast } = useToast();

  const { permission, isSupported, enableNotifications, isLoading } =
    usePushNotifications();

  const { data: transferMethods, isLoading: isLoadingTransferMethods } =
    useMyTransferMethods();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();
  const { mutate: forgotPassword, isPending: isResetting } =
    useForgotPassword();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [waitingForCaptcha, setWaitingForCaptcha] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const pendingReset = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setName(user?.name || "");
      setHomeCurrency(user?.homeCurrency || "");
      setHomeCurrencyError("");
    }
  }, [isEditing, user?.homeCurrency, user?.name]);

  const handleResetPassword = () => {
    if (!user?.email) return;

    if (captchaToken) {
      submitReset(captchaToken);
    } else if (config.TURNSTILE_SITE_KEY) {
      pendingReset.current = true;
      setWaitingForCaptcha(true);
    } else {
      forgotPassword({ email: user.email, captchaToken: "" }, {
        onSuccess: () => {
          toast({
            title: "Password reset email sent",
            description:
              "Check your email for instructions to reset your password",
          });
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to send reset email",
            description: err.message || "Something went wrong",
          });
        },
      });
    }
  };

  const submitReset = (token: string) => {
    setWaitingForCaptcha(false);
    forgotPassword({ email: user!.email, captchaToken: token }, {
      onSuccess: () => {
        toast({
          title: "Password reset email sent",
          description:
            "Check your email for instructions to reset your password",
        });
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      },
      onError: (error: unknown) => {
        const err = error as { message?: string };
        toast({
          variant: "destructive",
          title: "Failed to send reset email",
          description: err.message || "Something went wrong",
        });
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      },
    });
  };

  const handleCaptchaSuccess = (token: string) => {
    setCaptchaToken(token);
    if (pendingReset.current) {
      pendingReset.current = false;
      submitReset(token);
    }
  };

  const handleSave = () => {
    const result = profileSchema.safeParse({ name, homeCurrency });

    if (!result.success) {
      const nameIssue = result.error.issues.find(
        (issue) => issue.path[0] === "name",
      );
      const homeCurrencyIssue = result.error.issues.find(
        (issue) => issue.path[0] === "homeCurrency",
      );
      setHomeCurrencyError(homeCurrencyIssue?.message || "");
      if (nameIssue) {
        toast({
          variant: "destructive",
          title: "Invalid profile data",
          description: nameIssue.message,
        });
      }
      return;
    }

    updateProfile(result.data, {
      onSuccess: () => {
        refreshUser().then(() => {
          setIsEditing(false);
          toast({
            title: "Profile updated",
            description: "Your profile has been updated successfully",
          });
        });
      },
      onError: (error: unknown) => {
        const err = error as { message?: string };
        toast({
          variant: "destructive",
          title: "Update failed",
          description: err.message || "Something went wrong",
        });
      },
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const notificationPermissionDisplay = {
    granted: "You are receiving notifications",
    denied: "Notifications are blocked",
    default: "Enable notifications for this device",
  };

  const desktopEditButton = () => {
    if (isUpdating) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isEditing) return <Save className="h-4 w-4" />;
    return <Edit2 className="h-4 w-4" />;
  };

  const mobileEditButton = () => {
    if (isUpdating) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isEditing)
      return (
        <>
          <Save className="h-4 w-4 mr-2" />
          Save
        </>
      );
    return (
      <>
        <Edit2 className="h-4 w-4 mr-2" />
        Edit
      </>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-4">
            <AvatarCircle
              name={user?.name || "User"}
              imageUrl={user?.avatar}
              size="lg"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <CardTitle className="font-display truncate">
                {user?.name}
              </CardTitle>
              <CardDescription className="truncate">
                {user?.email}
              </CardDescription>
            </div>
            <Button
              variant={isEditing ? "default" : "outline"}
              size="icon"
              className="sm:hidden flex-shrink-0"
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={isUpdating}
            >
              {desktopEditButton()}
            </Button>
            <Button
              variant={isEditing ? "default" : "outline"}
              className="hidden sm:inline-flex flex-shrink-0"
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={isUpdating}
            >
              {mobileEditButton()}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Display Name
              </Label>
              {isEditing ? (
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              ) : (
                <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                  {user?.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </Label>
              <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg text-muted-foreground break-all">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="home-currency"
                className="flex items-center gap-2"
              >
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                Home Currency
              </Label>
              {isEditing ? (
                <>
                  <CurrencySelect
                    id="home-currency"
                    value={homeCurrency}
                    onChange={(value) => {
                      setHomeCurrency(value);
                      setHomeCurrencyError("");
                    }}
                    placeholder="Select home currency"
                  />
                  {homeCurrencyError && (
                    <p className="text-xs text-destructive">
                      {homeCurrencyError}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                  {user?.homeCurrency
                    ? `${user.homeCurrency} — ${getCurrencyName(user.homeCurrency)}`
                    : "Not set"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Member Since
              </Label>
              <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg text-muted-foreground">
                {user?.createdAt ? formatDate(user.createdAt) : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Methods */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="font-display flex items-center gap-2">
                Transfer Methods
              </CardTitle>
              <CardDescription>
                Your saved payment methods for receiving money
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setAddMethodModalOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Method</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TransferMethodsList
            methods={transferMethods}
            isLoading={isLoadingTransferMethods}
          />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            Notifications
          </CardTitle>
          <CardDescription>
            Stay updated with push notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-muted-foreground">
                {notificationPermissionDisplay[permission]}
              </p>
            </div>
            {permission === "granted" ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="text-green-600 border-green-200 bg-green-50 opacity-100 flex-shrink-0"
              >
                Enabled
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={enableNotifications}
                disabled={isLoading || !isSupported}
                className="flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Bell className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Enable</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="font-display">Security</CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">Reset Password</p>
              <p className="text-sm text-muted-foreground">
                Send a password reset link to your email
              </p>
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
                  pendingReset.current = false;
                  toast({ variant: "destructive", title: "Captcha failed", description: "Please try again" });
                }}
                options={{ size: "invisible" }}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              disabled={isResetting || waitingForCaptcha}
              className="flex-shrink-0 self-start sm:self-auto"
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive font-display">
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">Sign out</p>
              <p className="text-sm text-muted-foreground">
                Sign out from your account on this device
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setLogoutDialogOpen(true)}
              className="flex-shrink-0 self-start sm:self-auto"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Transfer Method Modal */}
      <AddTransferMethodModal
        open={addMethodModalOpen}
        onOpenChange={setAddMethodModalOpen}
      />

      {/* Logout confirmation */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={logout}
      />
    </div>
  );
}
