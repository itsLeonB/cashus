import { AvatarCircle } from "@/components/AvatarCircle";
import { Shield } from "lucide-react";
import type {
  ExpenseConfirmationResponse,
  ConfirmedExpenseParticipant,
} from "@/lib/api/types";
import { formatCurrency } from "@/lib/utils";

interface ExpenseConfirmationPreviewProps {
  data: ExpenseConfirmationResponse;
  showHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Small, single-purpose helpers
// ---------------------------------------------------------------------------

function buildCoveredByMap(
  participants: ExpenseConfirmationResponse["participants"],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of participants ?? []) {
    if (p.hasProxy && p.proxyProfile) {
      const proxyId = p.proxyProfile.id;
      if (!map[proxyId]) map[proxyId] = [];
      map[proxyId].push(p.profile.isUser ? "You" : p.profile.name);
    }
  }
  return map;
}

function PayerStatusLine({
  coveredNames,
}: Readonly<{ coveredNames: string[] }>) {
  return (
    <span className="text-primary font-medium">
      Paid the bill
      {coveredNames.length > 0 && (
        <span className="text-muted-foreground font-normal">
          {" "}
          · Covers: {coveredNames.join(", ")}
        </span>
      )}
    </span>
  );
}

function ProxyStatusLine({
  proxyProfile,
}: Readonly<{
  proxyProfile: NonNullable<ConfirmedExpenseParticipant["proxyProfile"]>;
}>) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Shield className="h-3 w-3" />
      Covered by{" "}
      <span className="font-medium text-foreground">
        {proxyProfile.isUser ? "You" : proxyProfile.name}
      </span>
    </span>
  );
}

function OwesStatusLine({
  payer,
  total,
  currency,
}: Readonly<{
  payer: ExpenseConfirmationResponse["payer"];
  total: ConfirmedExpenseParticipant["total"];
  currency: string;
}>) {
  return (
    <>
      Owes {payer.isUser ? "You" : payer.name}{" "}
      <span className="font-medium text-foreground">
        {formatCurrency(total, currency)}
      </span>
    </>
  );
}

function StatusLine({
  participant,
  payer,
  coveredNames,
  currency,
}: Readonly<{
  participant: ConfirmedExpenseParticipant;
  payer: ExpenseConfirmationResponse["payer"];
  coveredNames: string[];
  currency: string;
}>) {
  if (participant.profile.id === payer.id) {
    return <PayerStatusLine coveredNames={coveredNames} />;
  }
  if (participant.hasProxy && participant.proxyProfile) {
    return <ProxyStatusLine proxyProfile={participant.proxyProfile} />;
  }
  return (
    <OwesStatusLine
      payer={payer}
      total={participant.total}
      currency={currency}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared line-item row (used for both items and fees)
// ---------------------------------------------------------------------------

type LineItem = {
  id: string;
  name: string;
  baseAmount: string;
  shareAmount: string;
  shareRate: string;
};

function isFullShare(item: LineItem): boolean {
  return (
    item.shareRate === "1" ||
    item.shareRate === "100%" ||
    item.baseAmount === item.shareAmount
  );
}

function LineItemRow({
  item,
  currency,
}: Readonly<{ item: LineItem; currency: string }>) {
  const negative = Number.parseFloat(item.shareAmount) < 0;
  const amountClass = `tabular-nums text-right ${negative ? "text-green-600 dark:text-green-400" : ""}`;

  return (
    <div key={item.id} className="flex justify-between items-start">
      <span className="text-muted-foreground">{item.name}</span>
      <span className={amountClass}>
        {isFullShare(item) ? (
          formatCurrency(item.shareAmount, currency)
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(item.baseAmount, currency)} × {item.shareRate}{" "}
              ={" "}
            </span>
            {formatCurrency(item.shareAmount, currency)}
          </>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Items / Fees breakdown sections
// ---------------------------------------------------------------------------

function LineItemSection({
  label,
  items,
  subtotal,
  currency,
}: Readonly<{
  label: string;
  items: LineItem[];
  subtotal: string | number;
  currency: string;
}>) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <div className="space-y-1 text-sm">
        {items.map((item) => (
          <LineItemRow key={item.id} item={item} currency={currency} />
        ))}
      </div>
      <div className="flex justify-between pt-1 border-t border-border/30 text-sm">
        <span className="text-muted-foreground">{label} subtotal</span>
        <span className="tabular-nums font-medium">
          {formatCurrency(subtotal, currency)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single participant card
// ---------------------------------------------------------------------------

function ParticipantCard({
  participant,
  payer,
  coveredNames,
  currency,
}: Readonly<{
  participant: ConfirmedExpenseParticipant;
  payer: ExpenseConfirmationResponse["payer"];
  coveredNames: string[];
  currency: string;
}>) {
  const isCurrentUser = participant.profile.isUser;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        isCurrentUser
          ? "border-primary/50 bg-primary/5"
          : "border-border/50 bg-muted/30"
      }`}
    >
      {/* Participant Header */}
      <div className="flex items-center gap-2">
        <AvatarCircle
          name={participant.profile.name}
          imageUrl={participant.profile.avatar}
          size="sm"
        />
        <span className="font-medium">
          {participant.profile.name}
          {isCurrentUser && (
            <span className="text-xs text-muted-foreground ml-1">(You)</span>
          )}
        </span>
      </div>

      <LineItemSection
        label="Items"
        items={participant.items ?? []}
        subtotal={participant.itemsTotal}
        currency={currency}
      />

      <LineItemSection
        label="Fees"
        items={participant.fees ?? []}
        subtotal={participant.feesTotal}
        currency={currency}
      />

      {/* Participant Total & Status */}
      <div className="pt-2 border-t border-border/50 space-y-1">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">
            {formatCurrency(participant.total, currency)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          <StatusLine
            participant={participant}
            payer={payer}
            coveredNames={coveredNames}
            currency={currency}
          />
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections of the main component
// ---------------------------------------------------------------------------

function ExpenseHeader({
  data,
}: Readonly<{ data: ExpenseConfirmationResponse }>) {
  return (
    <div className="space-y-1 pb-3 border-b border-border/50">
      <p className="font-semibold text-lg">{data.description || "Expense"}</p>
      <p className="text-sm text-muted-foreground">
        Total: {formatCurrency(data.totalAmount || 0, data.currency)}
      </p>
      <p className="text-sm text-muted-foreground">Paid by {data.payer.name}</p>
    </div>
  );
}

function ParticipantList({
  participants,
  payer,
  coveredByMap,
  currency,
}: Readonly<{
  participants: ExpenseConfirmationResponse["participants"];
  payer: ExpenseConfirmationResponse["payer"];
  coveredByMap: Record<string, string[]>;
  currency: string;
}>) {
  if (!participants || participants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No participants found
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {participants.map((participant) => (
        <ParticipantCard
          key={participant.profile.id}
          participant={participant}
          payer={payer}
          coveredNames={coveredByMap[participant.profile.id] ?? []}
          currency={currency}
        />
      ))}
    </div>
  );
}

function SummaryFooter({
  participants,
  totalAmount,
  currency,
}: Readonly<{
  participants: ExpenseConfirmationResponse["participants"];
  totalAmount: number | undefined;
  currency: string;
}>) {
  if (!participants || participants.length === 0) return null;

  return (
    <div className="pt-3 border-t border-border/50 space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        Summary
      </p>
      <div className="space-y-1 text-sm">
        {participants.map((p) => (
          <div key={p.profile.id} className="flex justify-between">
            <span className="text-muted-foreground">{p.profile.name}</span>
            <span className="tabular-nums">
              {formatCurrency(p.total, currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2 border-t border-border/50 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">
          {formatCurrency(totalAmount || 0, currency)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export — now essentially a thin orchestrator
// ---------------------------------------------------------------------------

export function ExpenseConfirmationPreview({
  data,
  showHeader = false,
}: Readonly<ExpenseConfirmationPreviewProps>) {
  const coveredByMap = buildCoveredByMap(data.participants);

  return (
    <div className="space-y-4">
      {showHeader && <ExpenseHeader data={data} />}

      <ParticipantList
        participants={data.participants}
        payer={data.payer}
        coveredByMap={coveredByMap}
        currency={data.currency}
      />

      <SummaryFooter
        participants={data.participants}
        totalAmount={
          data.totalAmount === "" ? 0 : Number.parseFloat(data.totalAmount)
        }
        currency={data.currency}
      />
    </div>
  );
}
