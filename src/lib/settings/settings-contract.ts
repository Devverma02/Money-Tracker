import { z } from "zod";

export const preferredLanguageSchema = z.enum(["HINDI", "HINGLISH", "ENGLISH"]);
export const entryInputPreferenceSchema = z.enum(["TYPING", "MIC"]);
export const currencyCodeSchema = z.enum(["INR", "USD", "AED", "EUR", "GBP"]);
export const bucketKindSchema = z.enum([
  "PERSONAL",
  "GHAR",
  "DUKAAN",
  "KHETI",
  "CUSTOM",
]);

export const bucketSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: bucketKindSchema,
  isDefault: z.boolean(),
});

export const settingsResponseSchema = z.object({
  displayName: z.string().default(""),
  email: z.string().nullable().default(null),
  preferredLanguage: preferredLanguageSchema.default("HINGLISH"),
  timezone: z.string().min(1).default("Asia/Kolkata"),
  preferredCurrency: currencyCodeSchema.default("INR"),
  voiceRepliesEnabled: z.boolean().default(true),
  reminderDefaultTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default("09:00"),
  preferredEntryInput: entryInputPreferenceSchema.default("TYPING"),
  balanceGuardEnabled: z.boolean().default(true),
  defaultBucketSlug: z.string().min(1).default("personal"),
  buckets: z.array(bucketSummarySchema).default([]),
});

export const updateSettingsRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredLanguage: preferredLanguageSchema,
  timezone: z.string().trim().min(1).max(80),
  preferredCurrency: currencyCodeSchema,
  voiceRepliesEnabled: z.boolean(),
  reminderDefaultTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  preferredEntryInput: entryInputPreferenceSchema,
  balanceGuardEnabled: z.boolean(),
  defaultBucketSlug: z.string().trim().min(1).max(80),
});

export type PreferredLanguageValue = z.infer<typeof preferredLanguageSchema>;
export type EntryInputPreferenceValue = z.infer<typeof entryInputPreferenceSchema>;
export type CurrencyCodeValue = z.infer<typeof currencyCodeSchema>;
export type BucketKindValue = z.infer<typeof bucketKindSchema>;
export type BucketSummary = z.infer<typeof bucketSummarySchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export function getSpeechLocaleForLanguage(language: PreferredLanguageValue) {
  return language === "ENGLISH" ? "en-IN" : "hi-IN";
}
