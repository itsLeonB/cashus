import { useState, useEffect, type FormEventHandler } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCalculationMethods } from "@/hooks/useMasterData";
import { useAddExpenseFee, useUpdateExpenseFee } from "@/hooks/useApi";
import { Loader2, Receipt } from "lucide-react";
import type { NewOtherFeeRequest, OtherFeeResponse } from "@/lib/api/types";

interface ExpenseFeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  fee?: OtherFeeResponse | null;
  currency: string;
}

export function ExpenseFeeModal({
  open,
  onOpenChange,
  expenseId,
  fee,
  currency,
}: Readonly<ExpenseFeeModalProps>) {
  const { toast } = useToast();
  const { data: calculationMethods } = useCalculationMethods();
  const { mutate: addFee, isPending: isAdding } = useAddExpenseFee(expenseId);
  const { mutate: updateFee, isPending: isUpdating } =
    useUpdateExpenseFee(expenseId);
  const isLoading = isAdding || isUpdating;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [calculationMethod, setCalculationMethod] = useState("EQUAL_SPLIT");

  const isEditing = !!fee;

  useEffect(() => {
    if (fee) {
      setName(fee.name);
      setAmount(fee.amount);
      setCalculationMethod(fee.calculationMethod);
    } else {
      setName("");
      setAmount("");
      setCalculationMethod("EQUAL_SPLIT");
    }
  }, [fee, open]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    if (!name.trim() || !amount) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    const feeData = {
      name: name.trim(),
      amount,
      // SAFETY: `calculationMethod` is plain `useState<string>` because its
      // valid values come from a live-loaded, backend-driven list
      // (useCalculationMethods()) rather than a fixed frontend enum, so the
      // <Select> can't statically be typed to the narrower
      // "EQUAL_SPLIT" | "ITEMIZED_SPLIT" union NewOtherFeeRequest declares.
      // Both the fallback options above and every value useCalculationMethods()
      // can currently return are drawn from that same two-value backend
      // enum, so this cast holds in practice; it would need revisiting if
      // the backend ever adds a third calculation method.
      calculationMethod:
        calculationMethod as NewOtherFeeRequest["calculationMethod"],
    };

    if (isEditing && fee) {
      updateFee(
        { ...feeData, id: fee.id },
        {
          onSuccess: () => {
            toast({
              title: "Fee updated",
              description: `"${name}" has been updated.`,
            });
            onOpenChange(false);
          },
          onError: (error) => {
            toast({
              variant: "destructive",
              title: "Failed to update fee",
              description: getApiErrorMessage(error),
            });
          },
        },
      );
    } else {
      addFee(feeData, {
        onSuccess: () => {
          toast({
            title: "Fee added",
            description: `"${name}" has been added to the expense.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to add fee",
            description: getApiErrorMessage(error),
          });
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Fee" : "Add Fee"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feeName">Fee Name</Label>
            <Input
              id="feeName"
              placeholder="e.g., Service Charge, Tax"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feeAmount">Amount ({currency})</Label>
              <Input
                id="feeAmount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calcMethod">Type</Label>
              <Select
                value={calculationMethod}
                onValueChange={setCalculationMethod}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {calculationMethods?.map((method) => (
                    <SelectItem key={method.name} value={method.name}>
                      {method.display}
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="EQUAL_SPLIT">Equal split</SelectItem>
                      <SelectItem value="ITEMIZED_SPLIT">
                        Itemized split
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? "Update Fee" : "Add Fee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
