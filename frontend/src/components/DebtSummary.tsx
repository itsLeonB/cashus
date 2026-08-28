import { AmountDisplay } from "@/components/AmountDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { FriendBalance } from "@/lib/api";

type DebtSummaryProps = {
  data: FriendBalance | undefined;
  isLoading: boolean;
  error?: Error | null;
  isError?: boolean;
  currency?: string;
};

// Common card configuration
const cardConfigs = [
  {
    label: "Owed to you",
    amountKey: "totalLentToFriend" as const,
    icon: <TrendingUp className="h-5 w-5" />,
    variant: "positive" as const,
    sign: 1,
  },
  {
    label: "You owe",
    amountKey: "totalBorrowedFromFriend" as const,
    icon: <TrendingDown className="h-5 w-5" />,
    variant: "negative" as const,
    sign: -1,
  },
];

const DebtSummary = ({
  data,
  isLoading,
  error,
  isError,
  currency,
}: DebtSummaryProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="h-5 w-5" />
          <h3 className="font-semibold">Failed to load summary</h3>
        </div>
        <p className="text-sm opacity-90">
          {error?.message ||
            "Something went wrong while fetching your balances."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 sm:gap-6">
      {cardConfigs.map((config) => {
        const amount =
          Number.parseFloat(data?.[config.amountKey] || "0") * config.sign;

        return (
          <StatCard
            key={config.label}
            label={config.label}
            value={
              <AmountDisplay
                amount={amount}
                currency={currency}
                showSign={false}
                size="lg"
              />
            }
            icon={config.icon}
            variant={config.variant}
          />
        );
      })}
    </div>
  );
};

export default DebtSummary;
