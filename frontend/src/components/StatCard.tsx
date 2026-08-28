import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "positive" | "negative";
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  variant = "default",
  className,
}: Readonly<StatCardProps>) {
  return (
    <Card
      className={cn(
        "border-border/50 transition-all duration-200 hover:border-border",
        variant === "positive" && "stat-card-positive",
        variant === "negative" && "stat-card-negative",
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
            <div className="text-lg sm:text-2xl font-semibold font-display break-all">{value}</div>
          </div>
          {icon && (
            <div
              className={cn(
                "rounded-lg p-2",
                variant === "positive" && "bg-success/10 text-success",
                variant === "negative" && "bg-destructive/10 text-destructive",
                variant === "default" && "bg-muted text-muted-foreground"
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
