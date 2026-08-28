import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, Upload } from "lucide-react";
import { SubscriptionDetails } from "@/lib/api/profile";
import { CurrentSubscription } from "@/lib/api/types";

interface CurrentSubscriptionCardProps {
  subscription: SubscriptionDetails | null | undefined;
  currentSubscription: CurrentSubscription | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_BADGE_CONFIG: Record<
  string,
  {
    className: string;
    text: string;
    variant?: "outline" | "secondary" | "default";
  }
> = {
  canceled: {
    variant: "outline",
    className: "text-xs border-warning text-warning",
    text: "Canceled",
  },
  past_due_payment: {
    variant: "outline",
    className: "text-xs border-warning text-warning",
    text: "Past Due Payment",
  },
  incomplete_payment: {
    variant: "outline",
    className: "text-xs border-warning text-warning",
    text: "Incomplete Payment",
  },
  active: {
    variant: "default",
    className:
      "text-xs bg-success/15 text-success border-success/30 hover:bg-success/20",
    text: "Active",
  },
};

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const cfg = STATUS_BADGE_CONFIG[status];
  if (!cfg) return null;
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.text}
    </Badge>
  );
}

function WarningBanner({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
      <p className="text-sm text-warning">{children}</p>
    </div>
  );
}

function paymentDueMessage(days: number) {
  if (days < 0) return "";
  if (days === 0) return "Payment is due today.";
  if (days === 1) return "Payment will be due tomorrow.";
  return `Payment will be due in ${days} days.`;
}

export function CurrentSubscriptionCard({
  subscription,
  currentSubscription,
  isLoading,
  isError,
  onRetry,
}: Readonly<CurrentSubscriptionCardProps>) {
  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">
            Failed to load subscription details.
          </p>
          <button
            onClick={onRetry}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Free
            </Badge>
          </div>
          <CardDescription>
            You're on the free plan. Upgrade to unlock more features.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isCanceled =
    !!subscription.canceledAt || subscription.status === "canceled";
  const isPastDue = subscription.status === "past_due_payment";
  const isIncomplete = subscription.status === "incomplete_payment";
  const paymentDueDays = subscription?.paymentDueDays;
  const isNearingDueDate = paymentDueDays >= 0 && paymentDueDays <= 3;
  const uploads = currentSubscription?.limits?.uploads;

  const warningContent = () => {
    if (isCanceled) {
      const period = subscription.endsAt
        ? ` (${formatDate(subscription.endsAt)})`
        : "";
      return `Your plan will downgrade at the end of this billing period${period}.`;
    }
    if (isNearingDueDate)
      return `${paymentDueMessage(paymentDueDays)} Please make a payment soon.`;
    if (isPastDue) return "Your limits are downgraded, please make a payment.";
    if (isIncomplete)
      return "You have incomplete payment, please make a payment.";
    return null;
  };

  const warningBar = () => {
    const content = warningContent();
    if (content) return <WarningBanner>{content}</WarningBanner>;
    const paymentDueMsg = paymentDueMessage(paymentDueDays);
    if (paymentDueMsg)
      return <p className="text-sm">{paymentDueMessage(paymentDueDays)}</p>;
    return null;
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{subscription.planName}</CardTitle>
          <StatusBadge status={subscription.status} />
        </div>
        {subscription.endsAt && (
          <CardDescription>
            Until {formatDate(subscription.endsAt)}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {warningBar()}

        {uploads && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Upload Usage
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["daily", "monthly"] as const).map((period) => {
                const data = uploads[period];
                if (data.limit <= 0) return null;
                return (
                  <div
                    key={period}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="font-medium">
                        {data.used}/{data.limit}
                      </span>{" "}
                      <span className="text-muted-foreground">{period}</span>
                    </div>
                    {data.canUpload ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success ml-auto" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-warning ml-auto" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
