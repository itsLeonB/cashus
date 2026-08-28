import type { FriendBalance } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export function buildShareMessage(
  friendName: string,
  slug: string,
  balancesPerCurrency: Record<string, FriendBalance>,
): string {
  const baseUrl = globalThis.location.origin;
  const url = `${baseUrl}/f/${slug}`;

  const lines: string[] = [
    `Hey! Here's what I have recorded for our expenses:`,
  ];

  // Use first currency for the summary
  const currencies = Object.keys(balancesPerCurrency);
  const currency = currencies[0];
  const balance = balancesPerCurrency[currency];

  const getNetLabel = (net: number) => {
    if (net > 0) return `You owe ${formatCurrency(net, currency)}`;
    if (net < 0) return `I owe you ${formatCurrency(Math.abs(net), currency)}`;
    return "We're settled up!";
  };

  if (balance) {
    const net = Number.parseFloat(balance.netBalance || "0");
    const netLabel = getNetLabel(net);
    lines.push(`Net balance: ${netLabel}`);

    const txns = balance.transactionHistory || [];
    const shown = txns.slice(0, 3);
    for (const tx of shown) {
      const amt = formatCurrency(Number.parseFloat(tx.amount || "0"), currency);
      const desc = tx.description ? ` (${tx.description})` : "";
      lines.push(`- ${tx.type === "LENT" ? "Lent" : "Borrowed"} ${amt}${desc}`);
    }
    if (txns.length > 3) {
      lines.push(`...and ${txns.length - 3} other transactions.`);
    }
  }

  lines.push("", `View full details: ${url}`);

  return lines.join("\n");
}

export async function shareFriendProfile(
  friendName: string,
  slug: string,
  balancesPerCurrency: Record<string, FriendBalance>,
): Promise<"shared" | "copied" | "cancelled"> {
  const text = buildShareMessage(friendName, slug, balancesPerCurrency);

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      console.error("Share failed, falling back to clipboard", err);
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    throw new Error("Unable to share or copy to clipboard");
  }
}
