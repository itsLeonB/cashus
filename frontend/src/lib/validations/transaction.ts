import { z } from "zod";

// "YYYY-MM-DD" — zero-padded ISO date strings sort/compare lexicographically,
// so string comparison against today's date is sufficient to reject future dates.
// Derived from UTC date parts (not local getFullYear()/etc.) to match the
// backend's convention: transactionDate's "today" is the server's UTC
// calendar day, not the client's local day (see CASH-2 — timezone-aware
// client-local selection is explicitly out of scope).
export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// True only if value round-trips through the local Date constructor unchanged
// — catches calendar-invalid-but-regex-valid dates like "2026-02-30", which
// JS Date otherwise silently rolls over (to March 2) instead of producing NaN.
const isValidCalendarDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const transactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine(isValidCalendarDate, {
    message: "Enter a valid date",
  })
  .refine((value) => value <= getTodayDateString(), {
    message: "Transaction date can't be in the future",
  });

export type TransactionDateValue = z.infer<typeof transactionDateSchema>;
