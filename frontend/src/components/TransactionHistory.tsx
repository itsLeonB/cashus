import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Wallet,
  Plus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FriendBalance } from "@/lib/api";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function TransactionHistory({
  debts,
  friendName,
  currency,
  onRecordTransaction,
}: Readonly<{
  debts: FriendBalance["transactionHistory"];
  friendName: string;
  currency: string;
  onRecordTransaction?: () => void;
}>) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="font-display">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {debts.length > 0 ? (
          <div className="space-y-3">
            {debts.map((debt) => {
              const isCredit = debt.type === "LENT";
              return (
                <div
                  key={debt.id}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 rounded-lg bg-muted/30"
                >
                  <div
                    className={`h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      isCredit
                        ? "text-success bg-success/10"
                        : "text-warning bg-warning/10"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : (
                      <ArrowDownLeft className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        {isCredit ? "Lent" : "Borrowed"}
                      </p>
                      {debt.transferMethod && (
                        <Badge variant="outline" className="text-xs">
                          <Wallet className="h-3 w-3 mr-1" />
                          {debt.transferMethod}
                        </Badge>
                      )}
                    </div>
                    {debt.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 sm:truncate">
                        {debt.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(debt.createdAt)}
                      </p>
                      <p
                        className={`text-sm font-semibold tabular-nums sm:hidden ${
                          isCredit ? "text-success" : "text-warning"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatCurrency(debt.amount || 0, currency)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`hidden sm:block text-lg font-semibold tabular-nums flex-shrink-0 ${
                      isCredit ? "text-success" : "text-warning"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(debt.amount || 0, currency)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">No transactions yet</h3>
            {onRecordTransaction && (
              <>
                <p className="text-muted-foreground text-sm mb-4">
                  Record your first transaction with {friendName}
                </p>
                <Button onClick={onRecordTransaction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Transaction
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
