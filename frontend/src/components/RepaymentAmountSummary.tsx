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
      <p id={id} className="text-sm text-muted-foreground">
        Select a friend with an outstanding balance in {currency} to see the
        repayment amount.
      </p>
    );
  }

  const { verb, preposition } = getRepaymentDirection(netBalance);
  const name = friendName || "this friend";

  return (
    <div id={id} className="space-y-1">
      <p className="text-sm">
        You will {verb}{" "}
        <span className="font-semibold tabular-nums">
          {formatCurrency(Math.abs(netBalance), currency)}
        </span>{" "}
        {preposition} {name}
      </p>
      <p className="text-xs text-muted-foreground">
        This will bring your balance with {name} to zero.
      </p>
    </div>
  );
}
