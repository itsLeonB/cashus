import { useState } from "react";
import { Plus, Receipt, ArrowUpRight, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFABProps {
  onNewExpense: () => void;
  onRecordTransaction: () => void;
  onAddFriend: () => void;
}

export function MobileFAB({
  onNewExpense,
  onRecordTransaction,
  onAddFriend,
}: Readonly<MobileFABProps>) {
  const [expanded, setExpanded] = useState(false);

  const actions = [
    {
      label: "New Expense",
      icon: Receipt,
      onClick: onNewExpense,
    },
    {
      label: "Record Transaction",
      icon: ArrowUpRight,
      onClick: onRecordTransaction,
    },
    {
      label: "Add Friend",
      icon: Users,
      onClick: onAddFriend,
    },
  ];

  const handleAction = (action: () => void) => {
    setExpanded(false);
    action();
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 lg:hidden">
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[-1]"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Action items */}
      {expanded && (
        <div className="flex flex-col items-end gap-2 animate-fade-up">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action.onClick)}
              className="flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium whitespace-nowrap">
                {action.label}
              </span>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <action.icon className="h-4 w-4 text-primary" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? "Close actions menu" : "Open actions menu"}
        aria-expanded={expanded}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          expanded
            ? "bg-muted text-foreground rotate-0"
            : "gradient-primary text-primary-foreground",
        )}
      >
        {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
