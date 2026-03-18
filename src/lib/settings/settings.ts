import { PreferredLanguage, EntryInputPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SettingsResponse, UpdateSettingsRequest } from "@/lib/settings/settings-contract";

export async function getUserSettings(userId: string): Promise<SettingsResponse> {
  const profile = await prisma.appProfile.findUnique({
    where: {
      id: userId,
    },
    select: {
      displayName: true,
      email: true,
      preferredLanguage: true,
      timezone: true,
      voiceRepliesEnabled: true,
      reminderDefaultTime: true,
      preferredEntryInput: true,
    },
  });

  if (!profile) {
    throw new Error("The profile could not be found.");
  }

  return {
    displayName: profile.displayName ?? "",
    email: profile.email ?? null,
    preferredLanguage: profile.preferredLanguage ?? "HINGLISH",
    timezone: profile.timezone ?? "Asia/Kolkata",
    voiceRepliesEnabled: profile.voiceRepliesEnabled ?? true,
    reminderDefaultTime: profile.reminderDefaultTime ?? "09:00",
    preferredEntryInput: profile.preferredEntryInput ?? "TYPING",
  };
}

export async function updateUserSettings(
  userId: string,
  payload: UpdateSettingsRequest,
): Promise<SettingsResponse> {
  const profile = await prisma.appProfile.update({
    where: {
      id: userId,
    },
    data: {
      displayName: payload.displayName,
      preferredLanguage: payload.preferredLanguage as PreferredLanguage,
      timezone: payload.timezone,
      voiceRepliesEnabled: payload.voiceRepliesEnabled,
      reminderDefaultTime: payload.reminderDefaultTime,
      preferredEntryInput: payload.preferredEntryInput as EntryInputPreference,
    },
    select: {
      displayName: true,
      email: true,
      preferredLanguage: true,
      timezone: true,
      voiceRepliesEnabled: true,
      reminderDefaultTime: true,
      preferredEntryInput: true,
    },
  });

  return {
    displayName: profile.displayName ?? "",
    email: profile.email ?? null,
    preferredLanguage: profile.preferredLanguage ?? "HINGLISH",
    timezone: profile.timezone ?? "Asia/Kolkata",
    voiceRepliesEnabled: profile.voiceRepliesEnabled ?? true,
    reminderDefaultTime: profile.reminderDefaultTime ?? "09:00",
    preferredEntryInput: profile.preferredEntryInput ?? "TYPING",
  };
}
