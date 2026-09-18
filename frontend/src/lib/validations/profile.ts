import { z } from "zod";

// CASH-20 validations audit: this form-level schema submits against
// UpdateProfileInputBody (backend/openapi.json, see ProfilePage.tsx /
// OnboardingPage.tsx's `profileSchema.safeParse({ name, homeCurrency })`
// before the update-profile call). openapi-typescript (this repo's only
// wired-in OpenAPI codegen tool, see frontend/CLAUDE.md's "API codegen"
// section) generates TS *types* only, not Zod validators — a runtime
// Zod-schema generator (e.g. the Hey API Zod plugin CASH-19 evaluated as a
// stretch goal) was deliberately not adopted, so there is no live pipeline
// to generate this schema from. Kept fully hand-written; the constraints
// below are pinned by hand to UpdateProfileInputBody's actual JSON Schema
// keywords instead of duplicating its literal shape, so update both sides
// together if the backend's limits ever change:
//   - name: minLength 3, maxLength 255
//   - homeCurrency: minLength 3, maxLength 3 (an ISO 4217 currency code)
// The previous `homeCurrency: min(1)` under-validated this relative to the
// backend's actual (3-char) constraint — callers only ever submit codes
// from a currency picker, so this is a pure tightening, not a behavior
// change for any legitimate input.
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Display Name must be at least 3 characters")
    .max(255, "Display Name must be at most 255 characters"),
  homeCurrency: z
    .string()
    .trim()
    .length(3, "Home Currency must be a 3-letter currency code"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
