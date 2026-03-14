import { z } from "zod";

export const correctEntryRequestSchema = z
  .object({
    amount: z.number().positive().optional(),
    entryType: z
      .enum([
        "expense",
        "income",
        "loan_given",
        "loan_taken",
        "loan_received_back",
        "loan_repaid",
        "savings_deposit",
        "note",
      ])
      .optional(),
    category: z.string().trim().min(1).optional(),
    personName: z.string().trim().min(1).optional(),
    note: z.string().trim().min(1).optional(),
    resolvedDate: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).max(120).optional(),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.entryType !== undefined ||
      value.category !== undefined ||
      value.personName !== undefined ||
      value.note !== undefined ||
      value.resolvedDate !== undefined,
    {
      message: "Kam se kam ek field change honi chahiye.",
    },
  );

export const correctionResponseSchema = z.object({
  updated: z.boolean(),
  entryId: z.string().uuid(),
  message: z.string(),
});

export type CorrectEntryRequest = z.infer<typeof correctEntryRequestSchema>;
export type CorrectionResponse = z.infer<typeof correctionResponseSchema>;
