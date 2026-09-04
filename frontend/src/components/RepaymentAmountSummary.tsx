import { formatCurrency } from "@/lib/utils";

// Same net-balance sign drives both the wording ("receive"/"pay") and the
// preposition ("from"/"to") below — computed once here instead of via two
// separate ternaries.
function getRepaymentDirection(netBalance: number) {
  return netBalance > 0
    ? { verb: "receive", preposition: "from" }
    : { verb: "pay", preposition: "to" };
}

interface RepaymentAmountSummaryProps {
  id?: string;
  canPreview: boolean;
  netBalance: number;
  currency: string;
  friendName?: string;
}

// Read-only stand-in for the Amount input when "Repayment" is selected:
// shows the amount + direction the server will compute, derived from the
// friend's already-loaded net balance.
export function RepaymentAmountSummary({
  id,
  canPreview,
  netBalance,
  currency,
  friendName,
}: Readonly<RepaymentAmountSummaryProps>) {
  if (!canPreview) {
    return (
      <div
        id={id}
        className="rounded-lg border-2 border-border/50 bg-muted/30 p-3 text-sm"
      >
        <p className="text-muted-foreground">
          Select a friend with an outstanding balance in {currency} to see
          the repayment amount.
        </p>
      </div>
    );
  }

  const { verb, preposition } = getRepaymentDirection(netBalance);

  return (
    <div
      id={id}
      className="rounded-lg border-2 border-border/50 bg-muted/30 p-3 text-sm"
    >
      <p>
        You will {verb}{" "}
        <span className="font-semibold tabular-nums">
          {formatCurrency(Math.abs(netBalance), currency)}
        </span>{" "}
        {preposition} {friendName || "this friend"}
      </p>
    </div>
  );
}
