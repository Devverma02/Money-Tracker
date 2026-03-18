import { z } from "zod";

export const preferredLanguageSchema = z.enum(["HINDI", "HINGLISH", "ENGLISH"]);
export const entryInputPreferenceSchema = z.enum(["TYPING", "MIC"]);

export const settingsResponseSchema = z.object({
  displayName: z.string().default(""),
  email: z.string().nullable().default(null),
  preferredLanguage: preferredLanguageSchema.default("HINGLISH"),
  timezone: z.string().min(1).default("Asia/Kolkata"),
  voiceRepliesEnabled: z.boolean().default(true),
  reminderDefaultTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default("09:00"),
  preferredEntryInput: entryInputPreferenceSchema.default("TYPING"),
});

export const updateSettingsRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredLanguage: preferredLanguageSchema,
  timezone: z.string().trim().min(1).max(80),
  voiceRepliesEnabled: z.boolean(),
  reminderDefaultTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  preferredEntryInput: entryInputPreferenceSchema,
});

export type PreferredLanguageValue = z.infer<typeof preferredLanguageSchema>;
export type EntryInputPreferenceValue = z.infer<typeof entryInputPreferenceSchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

export function getSpeechLocaleForLanguage(language: PreferredLanguageValue) {
  return language === "ENGLISH" ? "en-IN" : "hi-IN";
}
