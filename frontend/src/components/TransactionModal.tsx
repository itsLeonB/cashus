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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { AvatarCircle } from "@/components/AvatarCircle";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CalendarIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TransferMethodSelect from "@/components/TransferMethodSelect";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencySelect } from "@/components/CurrencySelect";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  formatTransactionDateValue,
  getTodayDateString,
  parseTransactionDateValue,
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

// transactionDate is a plain "YYYY-MM-DD" calendar date with no time
// component; format it in the viewer's own locale (no explicit locale
// argument) but parse it in UTC so the displayed day doesn't shift for
// viewers behind UTC — same UTC-anchored parsing as
// RecentTransactions/TransactionHistory's formatDate.
const formatTransactionDateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export function TransactionModal({
  open,
  onOpenChange,
  defaultFriendId,
  defaultDirection = "OUTGOING",
}: Readonly<TransactionModalProps>) {
  const { user } = useAuth();
  const [friendId, setFriendId] = useState(defaultFriendId || "");
  const [direction, setDirection] = useState<DebtDirection>(defaultDirection);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.homeCurrency || "IDR");
  const [description, setDescription] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<TransferMethod>(null);
  const [transferMethodOpen, setTransferMethodOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [dateError, setDateError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
    if (!friendId || !amount || !selectedMethod?.id) return;

    const dateResult = transactionDateSchema.safeParse(transactionDate);
    if (!dateResult.success) {
      setDateError(dateResult.error.issues[0]?.message || "Invalid date");
      return;
    }
    setDateError(null);

    try {
      await createDebt.mutateAsync({
        friendProfileId: friendId,
        direction,
        amount: Number.parseFloat(amount),
        currency,
        transferMethodId: selectedMethod.id,
        description: description || undefined,
        transactionDate: dateResult.data,
      });
      toast({
        title: "Transaction recorded",
        description: `Successfully recorded ${directionConfig[
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
          <div className="grid grid-cols-2 gap-2">
            {DEBT_DIRECTIONS.map((key) => {
              const config = directionConfig[key];
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDirection(key)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center",
                    direction === key
                      ? config.colorClass
                      : "border-border/50 hover:border-border text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              );
            })}
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
              <Label htmlFor="amount">Amount</Label>
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
            </div>
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
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="transactionDate"
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {formatTransactionDateLabel(transactionDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {/* timeZone="UTC" anchors every grid cell, the built-in
                    "today" highlight, and the initial visible month to the
                    backend's UTC calendar day (see getTodayDateString) —
                    without it react-day-picker builds cells and "today" from
                    the viewer's local timezone, which for any viewer not at
                    UTC+0 disagrees with the UTC-based `disabled` cutoff below
                    and can grey out — or mislabel as "today" — the wrong
                    cell. */}
                <Calendar
                  mode="single"
                  timeZone="UTC"
                  selected={parseTransactionDateValue(transactionDate)}
                  onSelect={(date) => {
                    if (!date) return;
                    setTransactionDate(formatTransactionDateValue(date));
                    setDateError(null);
                    setDatePickerOpen(false);
                  }}
                  disabled={(date) =>
                    formatTransactionDateValue(date) > getTodayDateString()
                  }
                  autoFocus
                />
              </PopoverContent>
            </Popover>
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

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              !friendId ||
              !amount ||
              !selectedMethod?.id ||
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
