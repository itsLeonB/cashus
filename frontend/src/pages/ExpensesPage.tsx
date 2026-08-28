import { useState } from "react";
import { useGroupExpenses } from "@/hooks/useApi";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Receipt,
  Calendar,
  Users,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NewGroupExpenseModal } from "@/components/NewGroupExpenseModal";
import type { GroupExpenseResponse } from "@/lib/api/types";
import { formatCurrency } from "@/lib/utils";

type OwnershipType = "OWNED" | "PARTICIPATING";

interface ExpenseCardProps {
  expense: GroupExpenseResponse;
  ownership: OwnershipType;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function ExpenseCard({ expense, ownership }: Readonly<ExpenseCardProps>) {
  const isParticipating = ownership === "PARTICIPATING";

  return (
    <Link to={`/expenses/${expense.id}`}>
      <Card
        className={`border-border/50 hover:border-border transition-all hover:shadow-md ${isParticipating ? "bg-muted/30" : ""}`}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start sm:items-center gap-2 mb-1">
                <p className="font-medium line-clamp-2 sm:truncate text-sm sm:text-base">
                  {expense.description || "Untitled Expense"}
                </p>
                {isParticipating && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    <Eye className="h-3 w-3 mr-1" />
                    View only
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {expense.status === "CONFIRMED"
                    ? `Confirmed ${formatDate(expense.updatedAt)}`
                    : formatDate(expense.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {expense.participants?.length || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {expense.items?.length || 0} items
                </span>
              </div>
              {isParticipating && expense?.creator?.name && (
                <p className="text-xs text-muted-foreground mt-1">
                  Created by {expense.creator.name}
                </p>
              )}
              {/* Amount on mobile - below description */}
              <div className="flex items-center justify-between mt-2 sm:hidden">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(expense.totalAmount, expense.currency)}
                </p>
                {expense.payer.name && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Paid by</span>
                    <AvatarCircle
                      name={expense.payer.name}
                      imageUrl={expense.payer.avatar}
                      size="xs"
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Amount on desktop - right side */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(expense.totalAmount, expense.currency)}
                </p>
                {expense.payer.name && (
                  <p className="text-xs text-muted-foreground">Paid by</p>
                )}
              </div>
              {expense.payer.name && (
                <AvatarCircle
                  name={expense.payer.name}
                  imageUrl={expense.payer.avatar}
                  size="sm"
                />
              )}
              <ChevronRight
                className={`h-5 w-5 ${isParticipating ? "text-muted-foreground/50" : "text-muted-foreground"}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LoadingSkeletons() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={`expense-loading-${i}`} className="h-24" />
      ))}
    </div>
  );
}

function ExpenseList({
  expenses,
  isLoading,
  ownership,
}: Readonly<{
  expenses: GroupExpenseResponse[] | undefined;
  isLoading: boolean;
  ownership: OwnershipType;
}>) {
  if (isLoading) return <LoadingSkeletons />;
  if (!expenses || expenses.length === 0) return null;

  return (
    <div className="flex flex-col gap-y-3">
      {expenses.map((expense) => (
        <ExpenseCard key={expense.id} expense={expense} ownership={ownership} />
      ))}
    </div>
  );
}

export default function ExpensesPage() {
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("unconfirmed");

  // OWNED expenses
  const { data: draftExpenses, isLoading: isDraftLoading } = useGroupExpenses(
    "DRAFT",
    { ownership: "OWNED" },
  );
  const { data: readyExpenses, isLoading: isReadyLoading } = useGroupExpenses(
    "READY",
    { ownership: "OWNED" },
  );
  const { data: confirmedOwnedExpenses, isLoading: isConfirmedOwnedLoading } =
    useGroupExpenses("CONFIRMED", {
      ownership: "OWNED",
      enabled: activeTab === "confirmed",
    });

  // PARTICIPATING expenses
  const {
    data: participatingUnconfirmedExpenses,
    isLoading: isParticipatingUnconfirmedLoading,
  } = useGroupExpenses("UNCONFIRMED", { ownership: "PARTICIPATING" });

  const {
    data: participatingConfirmedExpenses,
    isLoading: isParticipatingConfirmedLoading,
  } = useGroupExpenses("CONFIRMED", {
    ownership: "PARTICIPATING",
    enabled: activeTab === "confirmed",
  });

  const hasOwnedUnconfirmed =
    (readyExpenses && readyExpenses.length > 0) ||
    (draftExpenses && draftExpenses.length > 0);

  const hasParticipatingUnconfirmed =
    participatingUnconfirmedExpenses &&
    participatingUnconfirmedExpenses.length > 0;

  const isUnconfirmedOwnedLoading = isDraftLoading || isReadyLoading;
  const hasAnyUnconfirmed = hasOwnedUnconfirmed || hasParticipatingUnconfirmed;

  const renderEmptyState = () => (
    <Card className="border-border/50">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Receipt className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-1">No group expenses yet</h3>
        <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
          Create your first group expense to split bills with friends easily
        </p>
        <Button variant="premium" onClick={() => setNewExpenseOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group Expense
        </Button>
      </CardContent>
    </Card>
  );

  const unconfirmedContent = () => {
    if (isUnconfirmedOwnedLoading && isParticipatingUnconfirmedLoading) {
      return <LoadingSkeletons />;
    }

    if (
      !hasAnyUnconfirmed &&
      !isUnconfirmedOwnedLoading &&
      !isParticipatingUnconfirmedLoading
    ) {
      return renderEmptyState();
    }

    return (
      <>
        {/* YOUR EXPENSES Section */}
        {(hasOwnedUnconfirmed || isUnconfirmedOwnedLoading) && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Your Expenses
            </h2>

            {isUnconfirmedOwnedLoading ? (
              <LoadingSkeletons />
            ) : (
              <>
                {/* Ready Expenses */}
                {readyExpenses && readyExpenses.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-medium text-muted-foreground/70 ml-1">
                      Ready to Confirm
                    </h3>
                    <ExpenseList
                      expenses={readyExpenses}
                      isLoading={false}
                      ownership="OWNED"
                    />
                  </div>
                )}

                {/* Divider between Ready and Draft */}
                {readyExpenses &&
                  readyExpenses.length > 0 &&
                  draftExpenses &&
                  draftExpenses.length > 0 && <Separator className="my-4" />}

                {/* Draft Expenses */}
                {draftExpenses && draftExpenses.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-medium text-muted-foreground/70 ml-1">
                      Drafts
                    </h3>
                    <ExpenseList
                      expenses={draftExpenses}
                      isLoading={false}
                      ownership="OWNED"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Divider between sections */}
        {hasOwnedUnconfirmed && hasParticipatingUnconfirmed && (
          <Separator className="my-6" />
        )}

        {/* PARTICIPATING Section */}
        {(hasParticipatingUnconfirmed || isParticipatingUnconfirmedLoading) && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Participating
            </h2>
            <ExpenseList
              expenses={participatingUnconfirmedExpenses}
              isLoading={isParticipatingUnconfirmedLoading}
              ownership="PARTICIPATING"
            />
          </div>
        )}
      </>
    );
  };

  const confirmedContent = () => {
    const isLoading =
      isConfirmedOwnedLoading || isParticipatingConfirmedLoading;
    const hasOwnedConfirmed =
      confirmedOwnedExpenses && confirmedOwnedExpenses.length > 0;
    const hasParticipatingConfirmed =
      participatingConfirmedExpenses &&
      participatingConfirmedExpenses.length > 0;
    const hasAnyConfirmed = hasOwnedConfirmed || hasParticipatingConfirmed;

    if (isLoading && !hasAnyConfirmed) {
      return <LoadingSkeletons />;
    }

    if (!hasAnyConfirmed && !isLoading) {
      return (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">No confirmed expenses</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Confirmed expenses will appear here once you finalize them
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        {/* YOUR EXPENSES Section */}
        {(hasOwnedConfirmed || isConfirmedOwnedLoading) && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Your Expenses
            </h2>
            <ExpenseList
              expenses={confirmedOwnedExpenses}
              isLoading={isConfirmedOwnedLoading}
              ownership="OWNED"
            />
          </div>
        )}

        {/* Divider between sections */}
        {hasOwnedConfirmed && hasParticipatingConfirmed && (
          <Separator className="my-6" />
        )}

        {/* PARTICIPATING Section */}
        {(hasParticipatingConfirmed || isParticipatingConfirmedLoading) && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Participating
            </h2>
            <ExpenseList
              expenses={participatingConfirmedExpenses}
              isLoading={isParticipatingConfirmedLoading}
              ownership="PARTICIPATING"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            Group Expenses
          </h1>
          <p className="text-muted-foreground mt-1">
            Split bills with multiple people
          </p>
        </div>
        <Button variant="premium" onClick={() => setNewExpenseOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Expense
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unconfirmed">Unconfirmed</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
        </TabsList>

        <TabsContent value="unconfirmed" className="space-y-6 mt-6">
          {unconfirmedContent()}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-6 mt-6">
          {confirmedContent()}
        </TabsContent>
      </Tabs>

      {/* New Expense Modal */}
      <NewGroupExpenseModal
        open={newExpenseOpen}
        onOpenChange={setNewExpenseOpen}
      />
    </div>
  );
}
