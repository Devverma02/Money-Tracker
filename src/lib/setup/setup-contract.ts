import { z } from "zod";

export const openingLoanDirectionSchema = z.enum(["RECEIVABLE", "PAYABLE"]);

export const openingLoanInputSchema = z.object({
  personName: z.string().trim().min(1).max(80),
  direction: openingLoanDirectionSchema,
  amount: z.number().positive().max(9_99_99_999),
});

export const setupResponseSchema = z.object({
  hasCompletedSetup: z.boolean().default(false),
  openingBalance: z.number().default(0),
  balanceGuardEnabled: z.boolean().default(true),
  setupCompletedAt: z.string().nullable().default(null),
  openingLoans: z.array(
    z.object({
      id: z.string().uuid(),
      personName: z.string().min(1),
      direction: openingLoanDirectionSchema,
      amount: z.number(),
    }),
  ).default([]),
});

export const updateSetupRequestSchema = z.object({
  openingBalance: z.number().min(0).max(9_99_99_999),
  balanceGuardEnabled: z.boolean(),
  openingLoans: z.array(openingLoanInputSchema).max(50).default([]),
  markSetupComplete: z.boolean().default(true),
});

export type OpeningLoanDirectionValue = z.infer<typeof openingLoanDirectionSchema>;
export type OpeningLoanInput = z.infer<typeof openingLoanInputSchema>;
export type SetupResponse = z.infer<typeof setupResponseSchema>;
export type UpdateSetupRequest = z.infer<typeof updateSetupRequestSchema>;
