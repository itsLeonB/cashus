import { useState, type FormEventHandler } from "react";
import { useFriendships, useCreateDebt } from "@/hooks/useApi";
import { useFilteredTransferMethods } from "@/hooks/useMasterData";
import { DebtDirection, TransferMethod } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AvatarCircle } from "@/components/AvatarCircle";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import TransferMethodSelect from "@/components/TransferMethodSelect";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencySelect } from "@/components/CurrencySelect";
import { TransactionDateField } from "@/components/TransactionDateField";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  getTodayDateString,
  transactionDateSchema,
} from "@/lib/validations/transaction";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFriendId?: string;
  defaultDirection?: DebtDirection;
}

const directionConfig = {
  OUTGOING: {
    label: "I gave money",
    description: "You gave money to friend",
    icon: ArrowUpRight,
    colorClass: "border-success text-success bg-success/10",
  },
  INCOMING: {
    label: "I received money",
    description: "You received money from friend",
    icon: ArrowDownLeft,
    colorClass: "border-warning text-warning bg-warning/10",
  },
} satisfies Record<
  DebtDirection,
  {
    label: string;
    description: string;
    icon: typeof ArrowUpRight;
    colorClass: string;
  }
>;

// SAFETY: directionConfig above is checked with `satisfies
// Record<DebtDirection, ...>`, so its keys are guaranteed to be exactly the
// DebtDirection variants — Object.keys just can't express that in its
// return type (string[]).
const DEBT_DIRECTIONS = Object.keys(directionConfig) as DebtDirection[];

export function TransactionModal({
  open,
  onOpenChange,
  defaultFriendId,
  defaultDirection = "OUTGOING",
}: Readonly<TransactionModalProps>) {
  const { user } = useAuth();
  const [friendId, setFriendId] = useState(defaultFriendId || "");
  const [direction, setDirection] = useState<DebtDirection>(defaultDirection);
  const [isRepayment, setIsRepayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.homeCurrency || "IDR");
  const [description, setDescription] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<TransferMethod>(null);
  const [transferMethodOpen, setTransferMethodOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: friendships } = useFriendships();
  const { data: transferMethods, isLoading: isLoadingMethods } =
    useFilteredTransferMethods("for-transaction", open);
  const createDebt = useCreateDebt();
  const { toast } = useToast();

  // Net balance for the selected friend in the selected currency, signed from
  // the current user's perspective: positive means the friend owes the user.
  const selectedFriendship = friendships?.find(
    (friendship) => friendship.profileId === friendId,
  );
  const zeroOutBalance = Number.parseFloat(
    selectedFriendship?.balancesPerCurrency?.[currency] ?? "0",
  );
  const canZeroOutBalance =
    !!friendId && !Number.isNaN(zeroOutBalance) && zeroOutBalance !== 0;

  const handleZeroOutBalance = () => {
    if (!canZeroOutBalance) return;
    setDirection(zeroOutBalance > 0 ? "INCOMING" : "OUTGOING");
    setAmount(Math.abs(zeroOutBalance).toFixed(2));
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!friendId || !selectedMethod?.id) return;
    if (isRepayment ? !canZeroOutBalance : !amount) return;

    const dateResult = transactionDateSchema.safeParse(transactionDate);
    if (!dateResult.success) {
      setDateError(dateResult.error.issues[0]?.message || "Invalid date");
      return;
    }
    setDateError(null);

    try {
      await createDebt.mutateAsync({
        friendProfileId: friendId,
        currency,
        transferMethodId: selectedMethod.id,
        transactionDate: dateResult.data,
        ...(isRepayment
          ? { isRepayment: true }
          : {
              direction,
              amount: Number.parseFloat(amount),
              description: description || undefined,
            }),
      });
      toast({
        title: "Transaction recorded",
        description: isRepayment
          ? `Successfully recorded repayment with ${
              selectedFriendship?.profileName || "friend"
            }`
          : `Successfully recorded ${directionConfig[
              direction
            ].label.toLowerCase()}`,
      });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to record transaction",
        description: getApiErrorMessage(error),
      });
    }
  };

  const resetForm = () => {
    setFriendId(defaultFriendId || "");
    setDirection(defaultDirection);
    setIsRepayment(false);
    setAmount("");
    setCurrency("IDR");
    setDescription("");
    setSelectedMethod(null);
    setTransactionDate(getTodayDateString());
    setDateError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Record Transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Direction Type */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {DEBT_DIRECTIONS.map((key) => {
                const config = directionConfig[key];
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setIsRepayment(false);
                      setDirection(key);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center",
                      !isRepayment && direction === key
                        ? config.colorClass
                        : "border-border/50 hover:border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={!canZeroOutBalance}
                onClick={() => setIsRepayment(true)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center disabled:opacity-40 disabled:cursor-not-allowed",
                  isRepayment
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border/50 hover:border-border text-muted-foreground",
                )}
              >
                <ArrowLeftRight className="h-5 w-5" />
                <span className="text-sm font-medium">Repayment</span>
              </button>
            </div>
            {!canZeroOutBalance && friendId && (
              <p className="text-xs text-muted-foreground">
                Balance is already settled in {currency} — nothing to repay.
              </p>
            )}
          </div>

          {/* Friend Selection */}
          <div className="space-y-2">
            <Label>Friend</Label>
            <Select value={friendId} onValueChange={setFriendId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a friend" />
              </SelectTrigger>
              <SelectContent>
                {friendships?.map((friendship) => (
                  <SelectItem
                    key={friendship.profileId}
                    value={friendship.profileId}
                  >
                    <div className="flex items-center gap-2">
                      <AvatarCircle
                        name={friendship.profileName}
                        imageUrl={friendship.profileAvatar}
                        size="xs"
                      />
                      <span>{friendship.profileName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">
                {isRepayment ? "Repayment amount" : "Amount"}
              </Label>
              {!isRepayment && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  disabled={!canZeroOutBalance}
                  onClick={handleZeroOutBalance}
                >
                  Zero out balance
                </Button>
              )}
            </div>
            {isRepayment ? (
              <div
                id="amount"
                className="rounded-lg border-2 border-border/50 bg-muted/30 p-3 text-sm"
              >
                {canZeroOutBalance ? (
                  <p>
                    {zeroOutBalance > 0 ? "You will receive" : "You will pay"}{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(Math.abs(zeroOutBalance), currency)}
                    </span>{" "}
                    {zeroOutBalance > 0 ? "from" : "to"}{" "}
                    {selectedFriendship?.profileName || "this friend"}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Select a friend with an outstanding balance in {currency}{" "}
                    to see the repayment amount.
                  </p>
                )}
              </div>
            ) : (
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="text-lg tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label>Currency</Label>
            <CurrencySelect
              value={currency}
              onChange={setCurrency}
              placeholder="Select currency"
            />
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transactionDate">Date</Label>
            <TransactionDateField
              id="transactionDate"
              value={transactionDate}
              onChange={(value) => {
                setTransactionDate(value);
                setDateError(null);
              }}
            />
            {dateError && (
              <p className="text-xs text-destructive">{dateError}</p>
            )}
          </div>

          {/* Transfer Method */}
          <TransferMethodSelect
            transferMethodOpen={transferMethodOpen}
            setTransferMethodOpen={setTransferMethodOpen}
            isLoadingMethods={isLoadingMethods}
            selectedMethod={selectedMethod}
            setSelectedMethod={setSelectedMethod}
            transferMethods={transferMethods}
          />

          {/* Description */}
          {!isRepayment && (
            <div className="space-y-2">
              <Label htmlFor="description">Note (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              !friendId ||
              !selectedMethod?.id ||
              (isRepayment ? !canZeroOutBalance : !amount) ||
              createDebt.isPending
            }
          >
            {createDebt.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Record Transaction
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
