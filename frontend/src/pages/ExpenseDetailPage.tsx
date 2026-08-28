import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useGroupExpense,
  useConfirmGroupExpense,
  useDeleteGroupExpense,
  useTriggerBillParsing,
  useDeleteExpenseItem,
  useDeleteExpenseFee,
} from "@/hooks/useApi";
import { useCalculationMethods } from "@/hooks/useMasterData";
import { AvatarCircle } from "@/components/AvatarCircle";
import { ExpenseItemModal } from "@/components/ExpenseItemModal";
import { ExpenseFeeModal } from "@/components/ExpenseFeeModal";
import { ItemParticipantManager } from "@/components/ItemParticipantManager";
import { ExpenseConfirmationPreview } from "@/components/ExpenseConfirmationPreview";
import { ParticipantSelector } from "@/components/ParticipantSelector";
import { ImageUploadArea } from "@/components/ImageUploadArea";
import { useUploadPermission } from "@/hooks/useUploadPermission";
import { UploadLimitInfo } from "@/components/UploadLimitInfo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Image,
  RefreshCw,
  AlertTriangle,
  Upload,
  UserPlus,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { NewExpenseItemRequest, statusDisplay } from "@/lib/api";
import { shareExpensePdf } from "@/utils/exportExpensePdf";
import type {
  ExpenseItemResponse,
  OtherFeeResponse,
  ExpenseConfirmationResponse,
} from "@/lib/api/types";

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const calculateItemAmount = (item: NewExpenseItemRequest): number => {
  const amount = Number.parseFloat(item.amount) || 0;
  return amount * item.quantity;
};

const billStatusDisplay: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PENDING: { label: "Processing...", variant: "secondary" },
  EXTRACTED: { label: "Processing...", variant: "secondary" },
  FAILED_EXTRACTING: { label: "Extraction Failed", variant: "destructive" },
  PARSED: { label: "Parsed", variant: "default" },
  FAILED_PARSING: { label: "Parsing Failed", variant: "destructive" },
  NOT_DETECTED: { label: "No Bill Image", variant: "outline" },
  NOT_UPLOADED: { label: "Not Uploaded", variant: "outline" },
};

const isRetryableStatus = (status: string) => {
  return status === "FAILED_EXTRACTING" || status === "FAILED_PARSING";
};

export default function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();

  // Polling logic for bill processing
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);

  const { data: expense, isLoading } = useGroupExpense(expenseId || "", {
    refetchInterval,
  });

  const canEdit = useMemo(() => {
    const isOwner = expense?.creator.isUser;
    const isConfirmed = expense?.status === "CONFIRMED";
    return isOwner && !isConfirmed;
  }, [expense?.creator.isUser, expense?.status]);

  // Update refetch interval based on bill status
  useEffect(() => {
    if (
      expense?.billExists &&
      (expense.bill.status === "PENDING" || expense.bill.status === "EXTRACTED")
    ) {
      setRefetchInterval(3000);
    } else {
      setRefetchInterval(false);
    }
  }, [expense?.billExists, expense?.bill?.status]);
  const confirmExpense = useConfirmGroupExpense(expenseId);
  const deleteExpense = useDeleteGroupExpense();
  const triggerBillParsing = useTriggerBillParsing(expenseId || "");
  const { toast } = useToast();
  const { mutate: deleteItem } = useDeleteExpenseItem();
  const { mutate: deleteFee } = useDeleteExpenseFee();
  const { data: calculationMethods } = useCalculationMethods();
  const uploadPermission = useUploadPermission();

  const calculationMethodDisplayByName = useMemo(() => {
    if (!calculationMethods) return {};
    return calculationMethods.reduce(
      (acc, method) => {
        acc[method.name] = method.display;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [calculationMethods]);

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null);

  // Item modal state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItemResponse | null>(
    null,
  );

  // Fee modal state
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<OtherFeeResponse | null>(null);

  // Bill modal state
  const [viewBillModalOpen, setViewBillModalOpen] = useState(false);
  const [retryBillModalOpen, setRetryBillModalOpen] = useState(false);
  const [uploadBillModalOpen, setUploadBillModalOpen] = useState(false);

  // Participant modal state
  const [participantModalOpen, setParticipantModalOpen] = useState(false);

  // Confirm dry-run modal state
  const [confirmPreviewModalOpen, setConfirmPreviewModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] =
    useState<ExpenseConfirmationResponse | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleSharePdf = async () => {
    if (!expense?.confirmationPreview) return;
    setIsExportingPdf(true);
    try {
      const result = await shareExpensePdf(expense.confirmationPreview);
      toast({
        title: result === "shared" ? "Shared!" : "PDF downloaded",
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const participantProfiles = (expense?.participants || []).map(
    (p) => p.participantProfile,
  );

  const currentParticipants = useMemo(() => {
    return (
      expense?.participants?.map((p) => ({
        profileId: p.participantProfile.id,
        name: p.participantProfile.name,
        avatar: p.participantProfile.avatar,
      })) || []
    );
  }, [expense?.participants]);

  const currentProxyMap = useMemo(() => {
    return (
      expense?.participants?.reduce<Record<string, string>>((acc, p) => {
        if (p.hasProxy && p.proxyProfile) {
          acc[p.participantProfile.id] = p.proxyProfile.id;
        }
        return acc;
      }, {}) || {}
    );
  }, [expense?.participants]);

  const calculateItemsTotal = () => {
    if (!expense?.items) return 0;
    return expense.items?.reduce((total, item) => {
      return total + calculateItemAmount(item);
    }, 0);
  };

  const calculateFeesTotal = () => {
    if (!expense?.otherFees) return 0;
    return expense.otherFees?.reduce((total, fee) => {
      return total + Number.parseFloat(fee.amount);
    }, 0);
  };

  const handleConfirmDryRun = async () => {
    if (!expenseId) return;

    setIsDryRunLoading(true);
    try {
      const result = await confirmExpense.mutateAsync(true);
      setDryRunResult(result);
      setConfirmPreviewModalOpen(true);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to preview",
        description: err.message || "Something went wrong",
      });
    } finally {
      setIsDryRunLoading(false);
    }
  };

  const handleConfirmFinal = async () => {
    if (!expenseId) return;

    try {
      await confirmExpense.mutateAsync(false);
      setConfirmPreviewModalOpen(false);
      setDryRunResult(null);
      toast({
        title: "Expense confirmed",
        description:
          "The expense has been confirmed and debts have been recorded",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to confirm",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!expense) return;

    setDeletingItemId(itemId);
    deleteItem(
      { expenseId: expense.id, itemId },
      {
        onSuccess: () => {
          toast({
            title: "Item removed",
            description: "The item has been removed from the expense.",
          });
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to remove item",
            description: err.message || "Something went wrong",
          });
        },
        onSettled: () => {
          setDeletingItemId(null);
        },
      },
    );
  };

  const handleDeleteFee = (feeId: string) => {
    if (!expense) return;

    setDeletingFeeId(feeId);
    deleteFee(
      { expenseId: expense.id, feeId },
      {
        onSuccess: () => {
          toast({
            title: "Fee removed",
            description: "The fee has been removed from the expense.",
          });
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to remove fee",
            description: err.message || "Something went wrong",
          });
        },
        onSettled: () => {
          setDeletingFeeId(null);
        },
      },
    );
  };

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: ExpenseItemResponse) => {
    setEditingItem(item);
    setItemModalOpen(true);
  };

  const openAddFeeModal = () => {
    setEditingFee(null);
    setFeeModalOpen(true);
  };

  const openEditFeeModal = (fee: OtherFeeResponse) => {
    setEditingFee(fee);
    setFeeModalOpen(true);
  };

  const handleRetryBillParsing = async () => {
    if (!expenseId || !expense?.bill?.id) return;

    try {
      await triggerBillParsing.mutateAsync(expense.bill.id);
      setRetryBillModalOpen(false);
      toast({
        title: "Retry initiated",
        description: "Bill processing has been restarted.",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to retry",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleUploadSuccess = () => {
    setUploadBillModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Expense not found</p>
        <Link to="/expenses">
          <Button variant="link">Back to Expenses</Button>
        </Link>
      </div>
    );
  }

  const isConfirmed = expense.status === "CONFIRMED";
  const isReady = expense.status === "READY";
  const isOwner = expense.creator.isUser;

  const billInformationSection = () => {
    if (isConfirmed && !expense.billExists) return null;
    const uploadDisabled = !uploadPermission.canUpload;
    return (
      <>
        <div className="border-t border-border/50 my-6" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">Bill Image</p>
              {expense.billExists ? (
                <Badge
                  variant={
                    billStatusDisplay[expense.bill.status]?.variant ||
                    "secondary"
                  }
                >
                  {billStatusDisplay[expense.bill.status]?.label ||
                    expense.bill.status}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No bill uploaded
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {expense.billExists ? (
              <>
                {expense.bill.imageUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewBillModalOpen(true)}
                  >
                    <Image className="h-4 w-4 mr-1" />
                    View Image
                  </Button>
                )}
                {isRetryableStatus(expense.bill.status) && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRetryBillModalOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                )}
                {(expense.bill.status === "NOT_DETECTED" ||
                  expense.bill.status === "NOT_UPLOADED") &&
                  canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadBillModalOpen(true)}
                      disabled={uploadDisabled}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Bill
                    </Button>
                  )}
              </>
            ) : (
              canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadBillModalOpen(true)}
                  disabled={uploadDisabled}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Bill
                </Button>
              )
            )}
          </div>
        </div>
        {canEdit && <UploadLimitInfo permission={uploadPermission} />}
      </>
    );
  };

  const otherFeeSection = () => {
    if (isConfirmed && (expense.otherFees?.length || 0) === 0) return null;
    return (
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Additional Fees</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openAddFeeModal}>
              <Plus className="h-4 w-4 mr-1" />
              Add Fee
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {expense.otherFees?.length > 0 ? (
            <div className="space-y-2">
              {expense.otherFees?.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fee.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {calculationMethodDisplayByName[fee.calculationMethod]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(fee.amount, expense.currency)}
                    </span>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditFeeModal(fee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFee(fee.id)}
                          disabled={deletingFeeId === fee.id}
                        >
                          {deletingFeeId === fee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>No additional fees.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Back Link */}
      <Link
        to="/expenses"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Expenses
      </Link>

      {/* Expense Header */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-display font-bold">
                  {expense.description || "Untitled Expense"}
                </h1>
                <Badge variant={isConfirmed ? "default" : "secondary"}>
                  {isConfirmed && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {statusDisplay[expense.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(expense.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {expense.participants?.length || 0} participants
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-3xl font-bold tabular-nums">
                {formatCurrency(expense.totalAmount, expense.currency)}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {expense.payer.name ? (
                  <>
                    <span>Paid by</span>
                    <AvatarCircle
                      name={expense.payer.name}
                      imageUrl={expense.payer.avatar}
                      size="xs"
                    />
                    <span className="font-medium text-foreground">
                      {expense.payer.isUser ? "You" : expense.payer.name}
                    </span>
                  </>
                ) : (
                  <span>No payer yet</span>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setParticipantModalOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>

          {billInformationSection()}
        </CardContent>
      </Card>

      {/* Split Preview (when isPreviewable) */}
      {expense.isPreviewable && expense.confirmationPreview && (
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Confirmed Splits</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSharePdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Share PDF
            </Button>
          </CardHeader>
          <CardContent>
            <ExpenseConfirmationPreview data={expense.confirmationPreview} />
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Items</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openAddItemModal}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {expense.items?.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border/50 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} ×{" "}
                    {formatCurrency(item.amount, expense.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(
                      Number.parseFloat(item.amount) * item.quantity,
                      expense.currency,
                    )}
                  </p>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditItemModal(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={deletingItemId === item.id}
                      >
                        {deletingItemId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <ItemParticipantManager
                  item={item}
                  expenseId={expense.id}
                  availableParticipants={participantProfiles}
                  isConfirmed={isConfirmed}
                  currency={expense.currency}
                  isReadOnly={!isOwner}
                />
              </div>
            </div>
          ))}

          {expense.items?.length < 1 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No items yet.</p>
              {canEdit && (
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={openAddItemModal}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first item
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {otherFeeSection()}

      {/* Summary */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(calculateItemsTotal(), expense.currency)}
              </span>
            </div>
            {expense.otherFees?.length > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Fees</span>
                <span className="tabular-nums">
                  {formatCurrency(calculateFeesTotal(), expense.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-2 border-t border-border/50">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCurrency(expense.totalAmount, expense.currency)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mt-6">
            {canEdit && (
              <>
                {isReady ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleConfirmDryRun}
                    disabled={
                      isDryRunLoading ||
                      confirmExpense.isPending ||
                      deleteExpense.isPending
                    }
                  >
                    {isDryRunLoading && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {!isDryRunLoading && (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Confirm & Record Debts
                  </Button>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning leading-relaxed">
                      Please assign participants to all items before confirming
                    </p>
                  </div>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      size="lg"
                      disabled={
                        deleteExpense.isPending || confirmExpense.isPending
                      }
                    >
                      {deleteExpense.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Expense
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this expense? This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async () => {
                          if (!expenseId) return;
                          try {
                            await deleteExpense.mutateAsync(expenseId);
                            toast({
                              title: "Expense deleted",
                              description:
                                "The expense has been deleted successfully.",
                            });
                            navigate("/expenses");
                          } catch (error: unknown) {
                            const err = error as { message?: string };
                            toast({
                              variant: "destructive",
                              title: "Failed to delete",
                              description:
                                err.message || "Something went wrong",
                            });
                          }
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* View-only helper text for non-owners */}
            {!isOwner && !isConfirmed && (
              <div className="text-center py-4 px-6 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Only the creator can edit or confirm this expense
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Item Modal */}
      <ExpenseItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        expenseId={expenseId || ""}
        item={editingItem}
        currency={expense.currency}
      />

      {/* Fee Modal */}
      <ExpenseFeeModal
        open={feeModalOpen}
        onOpenChange={setFeeModalOpen}
        expenseId={expenseId || ""}
        fee={editingFee}
        currency={expense.currency}
      />

      {/* View Bill Image Modal */}
      <Dialog open={viewBillModalOpen} onOpenChange={setViewBillModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bill Image</DialogTitle>
          </DialogHeader>
          {expense?.bill?.imageUrl && (
            <div className="flex items-center justify-center">
              <img
                src={expense.bill.imageUrl}
                alt="Bill"
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Retry Bill Parsing Confirmation Modal */}
      <AlertDialog
        open={retryBillModalOpen}
        onOpenChange={setRetryBillModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Retry Bill Processing
            </AlertDialogTitle>
            <AlertDialogDescription>
              The bill processing seems to have failed. Would you like to retry
              processing the bill image? This will attempt to parse the bill
              again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRetryBillParsing}
              disabled={triggerBillParsing.isPending}
            >
              {triggerBillParsing.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Retry Processing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Bill Modal */}
      <AlertDialog
        open={uploadBillModalOpen}
        onOpenChange={setUploadBillModalOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Upload Bill Image
            </AlertDialogTitle>
            <AlertDialogDescription>
              Uploading a bill image will trigger automatic parsing. If
              successful, this may overwrite existing items with the parsed
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ImageUploadArea
            expenseId={expenseId || ""}
            onUploadSuccess={handleUploadSuccess}
          />

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Participant Selector Modal */}
      <Dialog
        open={participantModalOpen}
        onOpenChange={setParticipantModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Edit Participants
            </DialogTitle>
          </DialogHeader>

          <ParticipantSelector
            expenseId={expense.id}
            currentParticipants={currentParticipants}
            currentPayerId={expense.payer?.id}
            currentProxyMap={currentProxyMap}
            onSuccess={() => {
              setParticipantModalOpen(false);
            }}
            onCancel={() => setParticipantModalOpen(false)}
            submitLabel="Save Participants"
            enableProxySelection={true}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Preview Modal */}
      <Dialog
        open={confirmPreviewModalOpen}
        onOpenChange={(open) => {
          if (!confirmExpense.isPending) {
            setConfirmPreviewModalOpen(open);
            if (!open) setDryRunResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Confirm Expense
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Clicking continue will record the following debts:
          </p>

          {dryRunResult && (
            <div className="max-h-[400px] overflow-y-auto">
              <ExpenseConfirmationPreview data={dryRunResult} showHeader />
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setConfirmPreviewModalOpen(false);
                setDryRunResult(null);
              }}
              disabled={confirmExpense.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmFinal}
              disabled={confirmExpense.isPending}
            >
              {confirmExpense.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
