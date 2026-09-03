import { z } from "zod";

// "YYYY-MM-DD" — zero-padded ISO date strings sort/compare lexicographically,
// so string comparison against today's date is sufficient to reject future dates.
export const getTodayDateString = () => new Date().toISOString().slice(0, 10);

export const transactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
    message: "Enter a valid date",
  })
  .refine((value) => value <= getTodayDateString(), {
    message: "Transaction date can't be in the future",
  });

export type TransactionDateValue = z.infer<typeof transactionDateSchema>;
