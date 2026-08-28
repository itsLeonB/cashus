import { ProfileTransferMethod } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TransferMethodsListProps {
  methods: ProfileTransferMethod[] | undefined;
  isLoading: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function TransferMethodsList({
  methods,
  isLoading,
  emptyMessage = "No transfer methods added yet",
  emptyDescription = "Add a payment method to receive money from friends",
}: Readonly<TransferMethodsListProps>) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopy = async (method: ProfileTransferMethod) => {
    try {
      await navigator.clipboard.writeText(method.accountNumber);
      setCopiedId(method.id);
      toast({
        title: "Copied to clipboard",
        description: `Account number for ${method.method.display} copied`,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border border-border/50"
          >
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!methods || methods.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
        <p className="text-xs mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {methods.map((method) => (
        <div
          key={method.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
        >
          <img
            src={method.method.iconUrl}
            alt={method.method.name}
            className="h-10 w-10 rounded object-contain bg-background p-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">
                {method.method.display}
              </p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {method.accountName}
            </p>
          </div>
          <button
            onClick={() => handleCopy(method)}
            className="text-right group flex items-center gap-2 hover:bg-muted/50 px-2 py-1 rounded transition-colors cursor-pointer"
            title="Click to copy account number"
          >
            <p className="font-mono text-sm">{method.accountNumber}</p>
            {copiedId === method.id ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
