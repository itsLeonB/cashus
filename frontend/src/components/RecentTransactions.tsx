import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Receipt } from "lucide-react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentDebts } from "@/hooks/useApi";
import { DebtTransactionResponse } from "@/lib/api";

const descriptionDisplay = (transaction: DebtTransactionResponse) => {
  if (transaction?.description) return transaction.description;
  if (transaction?.type === "LENT")
    return `Lent to ${transaction.profile.name}`;
  return `Borrowed from ${transaction.profile.name}`;
};

const RecentTransactions = () => {
  const { data, isLoading } = useRecentDebts();

  const cardContent = () => {
    if (isLoading)
      return (
        <div className="space-y-3">
          {["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4"].map(
            (key) => (
              <Skeleton key={key} className="h-14" />
            ),
          )}
        </div>
      );

    if ((data?.length || 0) === 0)
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No recent transactions</p>
        </div>
      );

    return (
      <div className="space-y-3">
        {data.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0"
          >
            {transaction.profile.name && (
              <AvatarCircle
                name={transaction.profile.name}
                imageUrl={transaction.profile.avatar}
                size="sm"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2 sm:truncate">
                {descriptionDisplay(transaction)}
              </p>
              {transaction.description && transaction.profile.name && (
                <p className="text-xs text-muted-foreground truncate">
                  with {transaction.profile.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {transaction.type === "LENT" ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
              <AmountDisplay
                amount={
                  transaction.type === "LENT"
                    ? Number.parseFloat(transaction.amount)
                    : Number.parseFloat(transaction.amount) * -1
                }
                size="sm"
                showSign={false}
                currency={transaction.currency}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-border/50 min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-display">
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">{cardContent()}</CardContent>
    </Card>
  );
};

export default RecentTransactions;
