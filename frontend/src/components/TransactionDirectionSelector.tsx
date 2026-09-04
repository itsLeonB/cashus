import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebtDirection } from "@/lib/api/types";

export const directionConfig = {
  OUTGOING: {
    label: "I gave money",
    description: "You gave money to friend",
    icon: ArrowUpRight,
    colorClass: "border-success text-success bg-success/10",
  },
  INCOMING: {
    label: "I received money",
    description: "You received money from friend",
    icon: ArrowDownLeft,
    colorClass: "border-warning text-warning bg-warning/10",
  },
} satisfies Record<
  DebtDirection,
  {
    label: string;
    description: string;
    icon: typeof ArrowUpRight;
    colorClass: string;
  }
>;

// SAFETY: directionConfig above is checked with `satisfies
// Record<DebtDirection, ...>`, so its keys are guaranteed to be exactly the
// DebtDirection variants — Object.keys just can't express that in its
// return type (string[]).
const DEBT_DIRECTIONS = Object.keys(directionConfig) as DebtDirection[];

interface TransactionDirectionSelectorProps {
  direction: DebtDirection;
  isRepayment: boolean;
  canRepay: boolean;
  friendSelected: boolean;
  currency: string;
  onSelectDirection: (direction: DebtDirection) => void;
  onSelectRepayment: () => void;
}

// Groups the "I gave money" / "I received money" / "Repayment" selector row
// together with its "nothing to repay" hint, so TransactionModal doesn't
// have to branch on isRepayment for each button individually.
export function TransactionDirectionSelector({
  direction,
  isRepayment,
  canRepay,
  friendSelected,
  currency,
  onSelectDirection,
  onSelectRepayment,
}: Readonly<TransactionDirectionSelectorProps>) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {DEBT_DIRECTIONS.map((key) => {
          const config = directionConfig[key];
          const Icon = config.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDirection(key)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center",
                !isRepayment && direction === key
                  ? config.colorClass
                  : "border-border/50 hover:border-border text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{config.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={!canRepay}
          onClick={onSelectRepayment}
          className={cn(
            "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center disabled:opacity-40 disabled:cursor-not-allowed",
            isRepayment
              ? "border-primary text-primary bg-primary/10"
              : "border-border/50 hover:border-border text-muted-foreground",
          )}
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span className="text-sm font-medium">Repayment</span>
        </button>
      </div>
      {!canRepay && friendSelected && (
        <p className="text-xs text-muted-foreground">
          Balance is already settled in {currency} — nothing to repay.
        </p>
      )}
    </div>
  );
}
