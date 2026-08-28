import { Activity, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import DebtSummary from "@/components/DebtSummary";
import CurrencyBalanceSummary from "@/components/CurrencyBalanceSummary";
import { TransactionHistory } from "@/components/TransactionHistory";
import type { FriendBalance } from "@/lib/api";

interface FriendBalanceSectionProps {
  balancesPerCurrency: Record<string, FriendBalance>;
  friendName: string;
  defaultCurrency?: string;
  isLoading?: boolean;
  error?: Error | null;
  isError?: boolean;
  onRecordTransaction?: () => void;
}

export function FriendBalanceSection({
  balancesPerCurrency,
  friendName,
  defaultCurrency = "IDR",
  isLoading = false,
  error,
  isError,
  onRecordTransaction,
}: Readonly<FriendBalanceSectionProps>) {
  const [activeCurrencyTab, setActiveCurrencyTab] = useState("");

  const currencies = Object.keys(balancesPerCurrency);
  const hasMultipleCurrencies = currencies.length > 1;
  const activeCurrency =
    activeCurrencyTab && balancesPerCurrency[activeCurrencyTab]
      ? activeCurrencyTab
      : currencies[0] || defaultCurrency;
  const activeBalance = balancesPerCurrency[activeCurrency];

  return (
    <>
      <Activity mode={hasMultipleCurrencies ? "visible" : "hidden"}>
        <>
          <CurrencyBalanceSummary
            balancesPerCurrency={balancesPerCurrency}
            onCurrencySelect={setActiveCurrencyTab}
          />
          <Tabs
            value={activeCurrency}
            onValueChange={setActiveCurrencyTab}
            className="space-y-4"
          >
            {currencies.map((currency) => (
              <TabsContent
                key={currency}
                value={currency}
                className="space-y-6"
              >
                <DebtSummary
                  data={balancesPerCurrency[currency]}
                  currency={currency}
                  isLoading={isLoading}
                  error={error}
                  isError={isError}
                />
                <TransactionHistory
                  debts={
                    balancesPerCurrency[currency]?.transactionHistory || []
                  }
                  friendName={friendName}
                  currency={currency}
                  onRecordTransaction={onRecordTransaction}
                />
              </TabsContent>
            ))}
          </Tabs>
        </>
      </Activity>
      <Activity mode={hasMultipleCurrencies ? "hidden" : "visible"}>
        <>
          <DebtSummary
            data={activeBalance}
            currency={activeCurrency}
            isLoading={isLoading}
            error={error}
            isError={isError}
          />
          <TransactionHistory
            debts={activeBalance?.transactionHistory || []}
            friendName={friendName}
            currency={activeCurrency}
            onRecordTransaction={onRecordTransaction}
          />
        </>
      </Activity>
    </>
  );
}
