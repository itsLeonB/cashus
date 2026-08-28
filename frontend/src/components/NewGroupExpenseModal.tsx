import { useState, type FormEventHandler } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateDraftExpense } from "@/hooks/useApi";
import {
  Loader2,
  Camera,
  PenLine,
  Receipt,
  ImageIcon,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ParticipantSelector } from "./ParticipantSelector";
import { ImageUploadArea } from "./ImageUploadArea";
import { CurrencySelect } from "./CurrencySelect";
import { useUploadPermission } from "@/hooks/useUploadPermission";
import { UploadLimitInfo } from "./UploadLimitInfo";

type InputType = "upload" | "manual";
type Step = "details" | "upload" | "participants";

interface NewGroupExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewGroupExpenseModal({
  open,
  onOpenChange,
}: Readonly<NewGroupExpenseModalProps>) {
  const { user } = useAuth();
  const defaultCurrency = user?.homeCurrency || "IDR";
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [inputType, setInputType] = useState<InputType>("upload");
  const [step, setStep] = useState<Step>("details");
  const [expenseId, setExpenseId] = useState<string | null>(null);

  const createDraft = useCreateDraftExpense();
  const navigate = useNavigate();
  const { toast } = useToast();
  const uploadPermission = useUploadPermission();
  const uploadBlocked = inputType === "upload" && !uploadPermission.isLoading && !uploadPermission.canUpload;

  const resetModal = () => {
    setDescription("");
    setCurrency(defaultCurrency);
    setInputType("upload");
    setStep("details");
    setExpenseId(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetModal();
    }
    onOpenChange(open);
  };

  const handleDetailsSubmit: FormEventHandler<HTMLFormElement> = async (
    e,
  ) => {
    e.preventDefault();

    if (!currency) {
      toast({
        variant: "destructive",
        title: "Currency is required",
        description: "Please select a currency for this expense.",
      });
      return;
    }

    try {
      const expense = await createDraft.mutateAsync({
        description: description || "",
        currency,
      });
      setExpenseId(expense.id);

      if (inputType === "upload") {
        setStep("upload");
      } else {
        setStep("participants");
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to create expense",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleUploadSuccess = () => {
    setStep("participants");
  };

  const handleSkipUpload = () => {
    setStep("participants");
  };

  const handleParticipantsSuccess = () => {
    handleOpenChange(false);
    if (expenseId) navigate(`/expenses/${expenseId}`);
  };

  const handleSkipParticipants = () => {
    if (expenseId) {
      handleOpenChange(false);
      navigate(`/expenses/${expenseId}`);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "details":
        return "New Group Expense";
      case "upload":
        return "Upload Bill";
      case "participants":
        return "Add Participants";
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case "details":
        return <Receipt className="h-5 w-5 text-primary" />;
      case "upload":
        return <ImageIcon className="h-5 w-5 text-primary" />;
      case "participants":
        return <Users className="h-5 w-5 text-primary" />;
    }
  };

  const handleBack = () => {
    if (step === "upload") {
      setStep("details");
    } else if (step === "participants") {
      if (inputType === "upload") {
        setStep("upload");
      } else {
        setStep("details");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {step !== "details" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {getStepIcon()}
            {getStepTitle()}
          </DialogTitle>
        </DialogHeader>

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Dinner at restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">
                Currency <span className="text-destructive">*</span>
              </Label>
              <CurrencySelect
                id="currency"
                value={currency}
                onChange={setCurrency}
              />
            </div>

            <div className="space-y-2">
              <Label>Input Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInputType("upload")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    inputType === "upload"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm font-medium">Upload Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputType("manual")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    inputType === "manual"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <PenLine className="h-6 w-6" />
                  <span className="text-sm font-medium">Manual Input</span>
                </button>
              </div>
            </div>

            {inputType === "upload" && (
              <UploadLimitInfo permission={uploadPermission} />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={createDraft.isPending || uploadBlocked || !currency}
            >
              {createDraft.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {inputType === "upload"
                ? "Next: Upload Bill"
                : "Next: Add Participants"}
            </Button>
          </form>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bill Image</Label>
              <ImageUploadArea
                expenseId={expenseId || undefined}
                onUploadSuccess={handleUploadSuccess}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleSkipUpload}
            >
              Skip
            </Button>
          </div>
        )}

        {step === "participants" && (
          <div className="space-y-3">
            <Label>Select Participants</Label>
            <ParticipantSelector
              expenseId={expenseId || undefined}
              onSuccess={handleParticipantsSuccess}
              showSkip
              onSkip={handleSkipParticipants}
              submitLabel="Continue"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
