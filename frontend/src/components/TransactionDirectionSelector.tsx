import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebtDirection } from "@/lib/api/types";

export const directionConfig = {
  OUTGOING: {
    label: "I gave money",
    icon: ArrowUpRight,
    activeClass: "border-success bg-success/10 text-success",
    iconWrapClass: "bg-success/15 text-success",
  },
  INCOMING: {
    label: "I received money",
    icon: ArrowDownLeft,
    activeClass: "border-warning bg-warning/10 text-warning",
    iconWrapClass: "bg-warning/15 text-warning",
  },
} satisfies Record<
  DebtDirection,
  {
    label: string;
    icon: typeof ArrowUpRight;
    activeClass: string;
    iconWrapClass: string;
  }
>;

// SAFETY: directionConfig above is checked with `satisfies
// Record<DebtDirection, ...>`, so its keys are guaranteed to be exactly the
// DebtDirection variants — Object.keys just can't express that in its
// return type (string[]).
const DEBT_DIRECTIONS = Object.keys(directionConfig) as DebtDirection[];

const INACTIVE_TILE_CLASS =
  "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40";

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface TransactionDirectionSelectorProps {
  direction: DebtDirection;
  isRepayment: boolean;
  canRepay: boolean;
  friendSelected: boolean;
  currency: string;
  onSelectDirection: (direction: DebtDirection) => void;
  onSelectRepayment: () => void;
}

// "I gave" / "I received" are two ends of the same axis, so they sit as an
// even pair. Repayment isn't a third direction — it settles a balance rather
// than adding to it — so it gets its own full-width row instead of forcing a
// 3-up grid, which is also what gives its label room to breathe and gives
// its state (available / nothing to repay yet / pick a friend first) a real
// place to be explained instead of a caption bolted on underneath.
export function TransactionDirectionSelector({
  direction,
  isRepayment,
  canRepay,
  friendSelected,
  currency,
  onSelectDirection,
  onSelectRepayment,
}: Readonly<TransactionDirectionSelectorProps>) {
  const repaymentHint = !friendSelected
    ? "Settle an existing balance"
    : canRepay
      ? `Clears the balance in ${currency}`
      : `Already settled in ${currency}`;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {DEBT_DIRECTIONS.map((key) => {
          const config = directionConfig[key];
          const Icon = config.icon;
          const active = !isRepayment && direction === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDirection(key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                FOCUS_RING_CLASS,
                active ? cn(config.activeClass, "shadow-sm") : INACTIVE_TILE_CLASS,
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  active ? config.iconWrapClass : "bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium leading-tight">
                {config.label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canRepay}
        onClick={onSelectRepayment}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS_RING_CLASS,
          isRepayment
            ? "border-primary bg-primary/8 text-primary shadow-sm"
            : INACTIVE_TILE_CLASS,
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isRepayment ? "bg-primary/15 text-primary" : "bg-muted",
          )}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-tight">
            Repayment
          </span>
          <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
            {repaymentHint}
          </span>
        </span>
      </button>
    </div>
  );
}
