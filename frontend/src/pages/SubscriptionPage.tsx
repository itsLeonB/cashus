import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSubscriptionDetails, useActivePlans } from "@/hooks/useApi";
import { useMakePayment, usePurchasePlan } from "@/hooks/useSubscription";
import { CurrentSubscriptionCard } from "@/components/CurrentSubscriptionCard";
import {
  PlanCard,
  PlanCardSkeleton,
  PlanCardsError,
} from "@/components/PlanCard";
import { useToast } from "@/hooks/use-toast";
import { CreditCard } from "lucide-react";
import { PaymentResponse } from "@/lib/api/plan";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const subscriptionQuery = useActiveSubscriptionDetails();
  const plansQuery = useActivePlans();
  const purchaseMutation = usePurchasePlan();
  const paymentMutation = useMakePayment();

  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  const currentSubscription = user?.currentSubscription;
  const subscription = subscriptionQuery.data;

  const handleSubscribe = async (
    planId: string,
    planVersionId: string,
    isPastDue: boolean,
    isNearingDueDate: boolean,
    isIncomplete: boolean,
  ) => {
    if (purchasingPlanId) {
      toast({
        title: "Payment already in progress",
        description:
          "Please complete the current payment before starting another.",
      });
      return;
    }

    setPurchasingPlanId(planVersionId);

    let mutator: () => Promise<PaymentResponse>;
    if (isPastDue || isNearingDueDate || isIncomplete) {
      mutator = async () => paymentMutation.mutateAsync(subscription.id);
    } else {
      mutator = async () =>
        purchaseMutation.mutateAsync({
          planId,
          planVersionId,
        });
    }

    try {
      const payment = await mutator();

      const redirectUrl = payment.gatewayTransactionId;
      if (!redirectUrl) {
        toast({
          title: "Error",
          description: "No payment URL received.",
          variant: "destructive",
        });
        setPurchasingPlanId(null);
        return;
      }

      globalThis.location.href = redirectUrl;
    } catch {
      toast({
        title: "Error",
        description: "Failed to start payment. Please try again.",
        variant: "destructive",
      });
      setPurchasingPlanId(null);
    }
  };

  const plansSection = () => {
    if (plansQuery.isLoading)
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      );

    if (plansQuery.isError)
      return <PlanCardsError onRetry={() => plansQuery.refetch()} />;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plansQuery.data.map((plan) => {
          const isCurrentPlan = subscription?.planVersionId === plan.id;
          const dueDays = subscription?.paymentDueDays;
          const isNearingDueDate =
            isCurrentPlan &&
            dueDays !== undefined &&
            dueDays >= 0 &&
            dueDays <= 3;

          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={isCurrentPlan}
              isPurchasing={purchasingPlanId === plan.id}
              isPastDue={
                isCurrentPlan && subscription?.status === "past_due_payment"
              }
              isNearingDueDate={isNearingDueDate}
              isIncomplete={
                isCurrentPlan && subscription?.status === "incomplete_payment"
              }
              onSubscribe={handleSubscribe}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display flex items-center gap-3">
          <CreditCard className="h-7 w-7 text-primary" />
          Your Plan
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* Section A — Current Subscription */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Current Subscription
        </h2>
        <CurrentSubscriptionCard
          subscription={subscription ?? null}
          currentSubscription={currentSubscription}
          isLoading={subscriptionQuery.isLoading}
          isError={subscriptionQuery.isError}
          onRetry={() => subscriptionQuery.refetch()}
        />
      </section>

      {/* Section B — Available Plans */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Available Plans
        </h2>
        {plansSection()}
      </section>
    </div>
  );
}
