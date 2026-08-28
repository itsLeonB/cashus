import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Display Name must be at least 3 characters"),
  homeCurrency: z.string().trim().min(1, "Home Currency is required"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
