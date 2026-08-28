import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { FriendBalance } from "@/lib/api";
import { getCurrencyName } from "@/hooks/useCurrencyCodes";
import { useAuth } from "@/contexts/AuthContext";

function CurrencyBalanceSummary({
  balancesPerCurrency,
  onCurrencySelect,
  isLoading,
  isError,
}: Readonly<{
  balancesPerCurrency?: Record<string, FriendBalance>;
  onCurrencySelect?: (currency: string) => void;
  isLoading?: boolean;
  isError?: boolean;
}>) {
  const { user } = useAuth();

  const balanceCurrencies = Object.keys(balancesPerCurrency ?? {});
  const fallbackHomeCurrency = user?.homeCurrency ? [user.homeCurrency] : [];
  const currencies =
    balanceCurrencies.length > 0 ? balanceCurrencies : fallbackHomeCurrency;

  const content = () => {
    if (isLoading)
      return (
        <div className="divide-y divide-border/50">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between px-6 py-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      );

    if (isError)
      return (
        <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
          Failed to load balances
        </div>
      );

    return (
      <div className="divide-y divide-border/50">
        {currencies.map((currency) => {
          const netBalance = Number.parseFloat(
            balancesPerCurrency?.[currency]?.netBalance || "0",
          );
          const isPositive = netBalance >= 0;
          const isClickable = !!onCurrencySelect;
          const Row = isClickable ? "button" : "div";

          return (
            <Row
              key={currency}
              className={`w-full flex items-center justify-between px-6 py-3 transition-colors text-left ${
                isClickable ? "hover:bg-muted/30 cursor-pointer" : ""
              }`}
              {...(isClickable && {
                onClick: () => onCurrencySelect(currency),
              })}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
                  {currency}
                </div>
                <span className="text-sm">{getCurrencyName(currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    isPositive ? "text-success" : "text-warning"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {formatCurrency(netBalance, currency)}
                </span>
                {isClickable && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Row>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-display">Balances</CardTitle>
        {!isLoading && !isError && (
          <span className="text-xs text-muted-foreground">
            {currencies.length}{" "}
            {currencies.length === 1 ? "currency" : "currencies"}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">{content()}</CardContent>
    </Card>
  );
}

export default CurrencyBalanceSummary;
