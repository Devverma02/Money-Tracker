import { z } from "zod";
import { parsedActionSchema } from "@/lib/ai/parse-contract";

export const saveEntryRequestSchema = z
  .object({
    action: parsedActionSchema.optional(),
    actions: z.array(parsedActionSchema).min(1).max(20).optional(),
    parserConfidence: z.number().min(0).max(1),
    confirmSave: z.literal(true),
  })
  .superRefine((value, ctx) => {
    const itemCount =
      (value.action ? 1 : 0) + (value.actions ? value.actions.length : 0);

    if (itemCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one parsed action is required.",
        path: ["actions"],
      });
    }

    if (value.action && value.actions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send either a single action or an actions array, not both.",
        path: ["actions"],
      });
    }
  });

export const savedEntryResultSchema = z.object({
  entryId: z.string().uuid(),
  duplicateWarning: z
    .object({
      fingerprint: z.string(),
      existingCount: z.number().int().min(1),
    })
    .nullable(),
});

export const saveEntryResponseSchema = z.object({
  saved: z.literal(true),
  savedCount: z.number().int().min(1),
  duplicateWarningCount: z.number().int().min(0),
  savedEntries: z.array(savedEntryResultSchema).min(1),
  message: z.string(),
});

export type SaveEntryRequest = z.infer<typeof saveEntryRequestSchema>;
export type SaveEntryResponse = z.infer<typeof saveEntryResponseSchema>;
