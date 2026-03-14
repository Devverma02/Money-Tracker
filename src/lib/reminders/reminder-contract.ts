import { z } from "zod";

export const createReminderRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  dueAt: z.string().datetime(),
  linkedPerson: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  bucket: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((value) => value || undefined),
});

export const createReminderResponseSchema = z.object({
  created: z.literal(true),
  reminderId: z.string().uuid(),
  message: z.string(),
});

export const snoozeReminderRequestSchema = z.object({
  snoozeUntil: z.string().datetime(),
});

export const reminderMutationResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string(),
});

export type CreateReminderRequest = z.infer<typeof createReminderRequestSchema>;
export type CreateReminderResponse = z.infer<typeof createReminderResponseSchema>;
export type SnoozeReminderRequest = z.infer<typeof snoozeReminderRequestSchema>;
export type ReminderMutationResponse = z.infer<typeof reminderMutationResponseSchema>;
