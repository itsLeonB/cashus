import { cn, formatCurrency } from "@/lib/utils";

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

export function AmountDisplay({
  amount,
  currency = "IDR",
  className,
  showSign = true,
  showLabel = false,
  size = "md",
}: Readonly<AmountDisplayProps>) {
  const isPositive = amount > 0;
  const isZero = amount === 0;

  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-3xl font-display",
  };

  const formattedAmount = formatCurrency(Math.abs(amount), currency);

  const getLabel = (isZero: boolean, isPositive: boolean): string => {
    if (isZero) return "Settled up";
    if (isPositive) return "They owe you";
    return "You owe";
  };

  const label = getLabel(isZero, isPositive);

  return (
    <div className={cn("flex flex-col", showLabel && "items-end")}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <span
        className={cn(
          "tabular-nums font-semibold",
          sizes[size],
          isZero && "text-muted-foreground",
          isPositive && !isZero && "text-success",
          !isPositive && !isZero && "text-destructive",
          className
        )}
      >
        {showSign && !isZero && (isPositive ? "+" : "-")}
        {formattedAmount}
      </span>
    </div>
  );
}
