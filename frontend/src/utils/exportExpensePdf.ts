import { jsPDF } from "jspdf";
import type { ExpenseConfirmationResponse } from "@/lib/api/types";
import { formatCurrency } from "@/lib/utils";

interface PdfContext {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  pageWidth: number;
  data: ExpenseConfirmationResponse;
  y: { value: number };
  addLine: (
    left: string,
    right: string,
    opts?: { bold?: boolean; size?: number },
  ) => void;
  checkPage: (needed: number) => void;
}

function renderParticipant(
  p: ExpenseConfirmationResponse["participants"][0],
  ctx: PdfContext,
) {
  const { doc, margin, contentWidth, data, y, addLine, checkPage } = ctx;

  checkPage(40);
  addLine(p.profile.name, "", { bold: true, size: 11 });

  // Items
  if (p.items?.length) {
    addLine("Items", "", { size: 8 });
    for (const item of p.items) {
      checkPage(8);
      addLine(`  ${item.name}`, formatCurrency(item.shareAmount, data.currency));
    }
    addLine("  Subtotal", formatCurrency(p.itemsTotal, data.currency), {
      bold: true,
    });
  }

  // Fees
  if (p.fees?.length) {
    addLine("Fees", "", { size: 8 });
    for (const fee of p.fees) {
      checkPage(8);
      addLine(`  ${fee.name}`, formatCurrency(fee.shareAmount, data.currency));
    }
    addLine("  Subtotal", formatCurrency(p.feesTotal, data.currency), {
      bold: true,
    });
  }

  // Total
  addLine("Total", formatCurrency(p.total, data.currency), {
    bold: true,
    size: 11,
  });

  // Status
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  if (p.profile.id === data.payer.id) {
    doc.text("Paid the bill", margin, y.value);
  } else if (p.hasProxy && p.proxyProfile) {
    doc.text(`Covered by ${p.proxyProfile.name}`, margin, y.value);
  } else {
    doc.text(
      `Owes ${data.payer.name} ${formatCurrency(p.total, data.currency)}`,
      margin,
      y.value,
    );
  }
  y.value += 8;

  // Separator between participants
  doc.setDrawColor(230);
  doc.line(margin, y.value, margin + contentWidth, y.value);
  y.value += 6;
}

export async function exportExpensePdf(
  data: ExpenseConfirmationResponse,
): Promise<File> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const yPos = { value: 20 };

  const addLine = (
    left: string,
    right: string,
    opts?: { bold?: boolean; size?: number },
  ) => {
    const size = opts?.size ?? 10;
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(left, margin, yPos.value);
    if (right)
      doc.text(right, pageWidth - margin, yPos.value, { align: "right" });
    yPos.value += size * 0.5 + 2;
  };

  const checkPage = (needed: number) => {
    if (yPos.value + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      yPos.value = 20;
    }
  };

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.description || "Expense", margin, yPos.value);
  yPos.value += 10;

  addLine(`Total: ${formatCurrency(data.totalAmount, data.currency)}`, "");
  addLine(`Paid by: ${data.payer.name}`, "");
  yPos.value += 4;

  // Separator
  doc.setDrawColor(200);
  doc.line(margin, yPos.value, pageWidth - margin, yPos.value);
  yPos.value += 8;

  // Participants
  const ctx: PdfContext = {
    doc,
    margin,
    contentWidth,
    pageWidth,
    data,
    y: yPos,
    addLine,
    checkPage,
  };
  for (const p of data.participants) {
    renderParticipant(p, ctx);
  }

  // Footer summary
  checkPage(30);
  yPos.value += 4;
  addLine("Summary", "", { bold: true, size: 12 });
  for (const p of data.participants) {
    addLine(`  ${p.profile.name}`, formatCurrency(p.total, data.currency));
  }
  addLine("Total", formatCurrency(data.totalAmount, data.currency), {
    bold: true,
    size: 11,
  });

  const filename = `${(data.description || "expense").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  const blob = doc.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}

export async function shareExpensePdf(
  data: ExpenseConfirmationResponse,
): Promise<"shared" | "downloaded"> {
  const file = await exportExpensePdf(data);

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: data.description || "Expense",
      files: [file],
    });
    return "shared";
  }

  // Fallback: download
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
