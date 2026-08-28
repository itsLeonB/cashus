import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, AlertTriangle, Loader2 } from "lucide-react";
import { PlanVersionResponse } from "@/lib/api/plan";
import { cn, formatCurrency } from "@/lib/utils";

interface PlanCardProps {
  plan: PlanVersionResponse;
  isCurrent: boolean;
  isPurchasing: boolean;
  isPastDue: boolean;
  isNearingDueDate: boolean;
  isIncomplete: boolean;
  onSubscribe: (
    planId: string,
    planVersionId: string,
    isPastDue: boolean,
    isNearingDueDate: boolean,
    isIncomplete: boolean,
  ) => void;
}

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "/ month",
  yearly: "/ year",
};

function formatInterval(interval: string) {
  return INTERVAL_LABELS[interval?.toLowerCase()] ?? `/ ${interval}`;
}

function formatUploadLimit(value: number, period: string) {
  return value === 0 ? "Unlimited" : `${value} per ${period}`;
}

export function PlanCard({
  plan,
  isCurrent,
  isPurchasing,
  isPastDue,
  isNearingDueDate,
  isIncomplete,
  onSubscribe,
}: Readonly<PlanCardProps>) {
  const hasIssue = isPastDue || isNearingDueDate || isIncomplete;
  const isCurrentAndClean = isCurrent && !hasIssue;

  const features = [
    {
      label: "Daily uploads",
      value: formatUploadLimit(plan.billUploadsDaily, "day"),
    },
    {
      label: "Monthly uploads",
      value: formatUploadLimit(plan.billUploadsMonthly, "month"),
    },
  ];

  const footerBtnText = () => {
    if (isPurchasing) return "Processing…";
    if (hasIssue) return "Make Payment";
    if (isCurrent) return "Current Plan";
    return "Subscribe";
  };

  const statusBadge = () => {
    if (isPastDue)
      return (
        <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 text-xs">
          Past Due
        </Badge>
      );
    if (isIncomplete)
      return (
        <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 text-xs">
          Incomplete
        </Badge>
      );
    if (isCurrentAndClean)
      return (
        <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 text-xs">
          Current
        </Badge>
      );
    return null;
  };

  return (
    <Card
      className={cn(
        "border-border/50 transition-all duration-200 flex flex-col",
        isCurrent && "border-primary/50 ring-1 ring-primary/20",
        (isPastDue || isIncomplete) &&
          "border-warning/50 ring-1 ring-warning/20",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.planName}</CardTitle>
          {statusBadge()}
        </div>
        <CardDescription>
          <span className="text-2xl font-bold font-display text-foreground">
            {formatCurrency(plan.priceAmount)}
          </span>{" "}
          <span className="text-muted-foreground">
            {formatInterval(plan.billingInterval)}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{feature.value}</span>{" "}
                <span className="text-muted-foreground">— {feature.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      {!plan.isDefault && (
        <CardFooter>
          <Button
            className="w-full"
            variant={isCurrentAndClean ? "secondary" : "default"}
            disabled={isCurrentAndClean || isPurchasing}
            onClick={() =>
              onSubscribe(
                plan.planId,
                plan.id,
                isPastDue,
                isNearingDueDate,
                isIncomplete,
              )
            }
          >
            {isPurchasing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {footerBtnText()}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export function PlanCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

export function PlanCardsError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">
          Failed to load available plans.
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
