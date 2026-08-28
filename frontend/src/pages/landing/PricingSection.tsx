import { useActivePlans } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function formatInterval(interval: string) {
  switch (interval?.toLowerCase()) {
    case "monthly":
      return "/ month";
    case "yearly":
      return "/ year";
    default:
      return `/ ${interval}`;
  }
}

export function PricingSection() {
  const plansQuery = useActivePlans();

  return (
    <section className="py-16 sm:py-24" id="pricing">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold font-display">
            Simple, <span className="text-gradient-primary">transparent</span>{" "}
            pricing
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        {plansQuery.isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[1, 2].map((i) => (
              <Card key={i} className="border-border/50">
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-32 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {plansQuery.isError && (
          <div className="text-center text-muted-foreground">
            <p>Could not load plans.</p>
            <button
              onClick={() => plansQuery.refetch()}
              className="text-primary hover:underline text-sm mt-2"
            >
              Try again
            </button>
          </div>
        )}

        {plansQuery.data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {plansQuery.data.map((plan) => {
              const isDefault = plan.isDefault;
              const isPaid = !isDefault;
              const features = [
                {
                  label: "Daily uploads",
                  value:
                    plan.billUploadsDaily === 0
                      ? "Unlimited"
                      : `${plan.billUploadsDaily} per day`,
                },
                {
                  label: "Monthly uploads",
                  value:
                    plan.billUploadsMonthly === 0
                      ? "Unlimited"
                      : `${plan.billUploadsMonthly} per month`,
                },
              ];

              return (
                <Card
                  key={plan.id}
                  className={`border-border/50 flex flex-col transition-all duration-200 ${
                    isPaid ? "border-primary/50 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.planName}</CardTitle>
                      {isPaid && (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      <span className="text-2xl font-bold font-display text-foreground">
                        {formatCurrency(plan.priceAmount)}
                      </span>{" "}
                      {!isDefault && (
                        <span className="text-muted-foreground">
                          {formatInterval(plan.billingInterval)}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <ul className="space-y-2.5">
                      {features.map((f) => (
                        <li
                          key={f.label}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          <span>
                            <span className="font-medium">{f.value}</span>{" "}
                            <span className="text-muted-foreground">
                              — {f.label}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
