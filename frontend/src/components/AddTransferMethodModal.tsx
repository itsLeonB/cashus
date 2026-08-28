import { useState, type FormEventHandler } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useFilteredTransferMethods } from "@/hooks/useMasterData";
import { useToast } from "@/hooks/use-toast";
import { useAddTransferMethod } from "@/hooks/useApi";
import TransferMethodSelect from "@/components/TransferMethodSelect";
import { TransferMethod } from "@/lib/api";

interface AddTransferMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransferMethodModal({
  open,
  onOpenChange,
}: Readonly<AddTransferMethodModalProps>) {
  const [selectedMethod, setSelectedMethod] = useState<TransferMethod>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const { data: transferMethods, isLoading: isLoadingMethods } =
    useFilteredTransferMethods("children", open);
  const { toast } = useToast();
  const { mutate: addTransferMethod, isPending: isAdding } =
    useAddTransferMethod();

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    if (!selectedMethod?.id || !accountName.trim() || !accountNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all fields",
      });
      return;
    }

    addTransferMethod(
      {
        transferMethodId: selectedMethod?.id,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      },
      {
        onSuccess: () => {
          toast({
            title: "Transfer method added",
            description: "Your transfer method has been saved successfully",
          });

          // Reset form and close modal
          setSelectedMethod(null);
          setAccountName("");
          setAccountNumber("");
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to add transfer method",
            description: err.message || "Something went wrong",
          });
        },
      },
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedMethod(null);
      setAccountName("");
      setAccountNumber("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Add Transfer Method
          </DialogTitle>
          <DialogDescription>
            Add a new payment method to receive money from friends
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transfer Method Selector */}
          <TransferMethodSelect
            transferMethodOpen={comboboxOpen}
            setTransferMethodOpen={setComboboxOpen}
            isLoadingMethods={isLoadingMethods}
            selectedMethod={selectedMethod}
            setSelectedMethod={setSelectedMethod}
            transferMethods={transferMethods}
          />

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., John Doe"
            />
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g., 1234567890"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add Method"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
