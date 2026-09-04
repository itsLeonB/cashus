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
import { Loader2 } from "lucide-react";
import {
  TransactionDirectionSelector,
  directionConfig,
} from "@/components/TransactionDirectionSelector";
import { RepaymentAmountSummary } from "@/components/RepaymentAmountSummary";
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
  // the current user's perspective: positive means the friend owes the
  // user. Drives the Repayment option's preview and its disabled state.
  const selectedFriendship = friendships?.find(
    (friendship) => friendship.profileId === friendId,
  );
  const zeroOutBalance = Number.parseFloat(
    selectedFriendship?.balancesPerCurrency?.[currency] ?? "0",
  );
  const canZeroOutBalance =
    !!friendId && !Number.isNaN(zeroOutBalance) && zeroOutBalance !== 0;

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
          <TransactionDirectionSelector
            direction={direction}
            isRepayment={isRepayment}
            canRepay={canZeroOutBalance}
            friendSelected={!!friendId}
            currency={currency}
            onSelectDirection={(key) => {
              setIsRepayment(false);
              setDirection(key);
            }}
            onSelectRepayment={() => setIsRepayment(true)}
          />

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
            <Label htmlFor="amount">
              {isRepayment ? "Repayment amount" : "Amount"}
            </Label>
            {isRepayment ? (
              <RepaymentAmountSummary
                id="amount"
                canPreview={canZeroOutBalance}
                netBalance={zeroOutBalance}
                currency={currency}
                friendName={selectedFriendship?.profileName}
              />
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
