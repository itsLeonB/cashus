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
import { useToast } from "@/hooks/use-toast";
import { useAddExpenseItem, useUpdateExpenseItem } from "@/hooks/useApi";
import { Loader2, Package } from "lucide-react";
import type { ExpenseItemResponse } from "@/lib/api/types";

interface ExpenseItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  item?: ExpenseItemResponse | null;
  currency: string;
}

export function ExpenseItemModal({
  open,
  onOpenChange,
  expenseId,
  item,
  currency,
}: Readonly<ExpenseItemModalProps>) {
  const { toast } = useToast();
  const { mutate: addItem, isPending: isAdding } = useAddExpenseItem(expenseId);
  const { mutate: updateItem, isPending: isUpdating } =
    useUpdateExpenseItem(expenseId);
  const isLoading = isAdding || isUpdating;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);

  const isEditing = !!item;

  useEffect(() => {
    if (item) {
      setName(item.name);
      setAmount(item.amount);
      setQuantity(item.quantity);
    } else {
      setName("");
      setAmount("");
      setQuantity(1);
    }
  }, [item, open]);

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

    const itemData = {
      name: name.trim(),
      amount,
      quantity,
    };

    if (isEditing && item) {
      updateItem(
        { ...itemData, id: item.id },
        {
          onSuccess: () => {
            toast({
              title: "Item updated",
              description: `"${name}" has been updated.`,
            });
            onOpenChange(false);
          },
          onError: (error: unknown) => {
            const err = error as { message?: string };
            toast({
              variant: "destructive",
              title: "Failed to update item",
              description: err.message || "Something went wrong",
            });
          },
        },
      );
    } else {
      addItem(itemData, {
        onSuccess: () => {
          toast({
            title: "Item added",
            description: `"${name}" has been added to the expense.`,
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to add item",
            description: err.message || "Something went wrong",
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
            <Package className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Item" : "Add Item"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              placeholder="e.g., Pizza, Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Number.parseInt(e.target.value) || 1)
                }
                min="1"
                required
              />
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
              {isEditing ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
