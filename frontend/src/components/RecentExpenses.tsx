import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRecentExpenses } from "@/hooks/useApi";
import { Link } from "react-router-dom";
import { statusDisplay } from "@/lib/api/types";
import { cn } from "@/lib/utils";
const RecentExpenses = () => {
  const { data, isLoading } = useRecentExpenses();

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
          <p>No recent expenses</p>
        </div>
      );

    return (
      <div className="space-y-3">
        {data.map((expense) => (
          <Link
            to={`/expenses/${expense.id}`}
            key={expense.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors min-w-0 cursor-pointer"
          >
            {expense.creator.name && (
              <AvatarCircle
                name={expense.creator.name}
                imageUrl={expense.creator.avatar}
                size="sm"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2 sm:truncate">
                {expense.description}
              </p>
              {expense.description && expense.creator.name && (
                <p className="text-xs text-muted-foreground truncate">
                  by {expense.creator.isUser ? "You" : expense.creator.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  expense.status === "DRAFT" &&
                    "border-muted-foreground/50 text-muted-foreground",
                  expense.status === "READY" && "border-warning text-warning",
                  expense.status === "CONFIRMED" &&
                    "border-success text-success",
                )}
              >
                {statusDisplay[expense.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-border/50 min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-display">Recent Expenses</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">{cardContent()}</CardContent>
    </Card>
  );
};

export default RecentExpenses;
