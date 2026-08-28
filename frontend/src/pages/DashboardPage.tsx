import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionModal } from "@/components/TransactionModal";
import { NewGroupExpenseModal } from "@/components/NewGroupExpenseModal";
import { AddFriendModal } from "@/components/AddFriendModal";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import RecentTransactions from "@/components/RecentTransactions";
import RecentExpenses from "@/components/RecentExpenses";
import { MobileFAB } from "@/components/MobileFAB";
import { useDebtSummary } from "@/hooks/useApi";
import CurrencyBalanceSummary from "@/components/CurrencyBalanceSummary";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: debtSummary, isLoading, isError } = useDebtSummary();

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            {greeting}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's your financial overview
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" onClick={() => setTransactionOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Transaction
          </Button>
          <Button variant="outline" onClick={() => setAddFriendModalOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Add Friend
          </Button>
          <Button variant="premium" onClick={() => setExpenseModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      <CurrencyBalanceSummary
        balancesPerCurrency={debtSummary}
        isLoading={isLoading}
        isError={isError}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions />
        <RecentExpenses />
      </div>

      {/* Mobile FAB replaces Quick Actions on mobile */}
      <MobileFAB
        onNewExpense={() => setExpenseModalOpen(true)}
        onRecordTransaction={() => setTransactionOpen(true)}
        onAddFriend={() => setAddFriendModalOpen(true)}
      />

      {/* Transaction Modal */}
      <TransactionModal
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
      />

      {/* New Group Expense Modal */}
      <NewGroupExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
      />

      {/* Add Friend Modal */}
      <AddFriendModal
        open={addFriendModalOpen}
        onOpenChange={setAddFriendModalOpen}
      />
    </div>
  );
}
