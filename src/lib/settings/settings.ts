import { CurrencyCode, PreferredLanguage, EntryInputPreference } from "@prisma/client";
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
      preferredCurrency: true,
      voiceRepliesEnabled: true,
      reminderDefaultTime: true,
      preferredEntryInput: true,
      balanceGuardEnabled: true,
      defaultBucket: {
        select: {
          slug: true,
        },
      },
      buckets: {
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
        },
        orderBy: [
          {
            kind: "asc",
          },
          {
            name: "asc",
          },
        ],
      },
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
    preferredCurrency: profile.preferredCurrency ?? "INR",
    voiceRepliesEnabled: profile.voiceRepliesEnabled ?? true,
    reminderDefaultTime: profile.reminderDefaultTime ?? "09:00",
    preferredEntryInput: profile.preferredEntryInput ?? "TYPING",
    balanceGuardEnabled: profile.balanceGuardEnabled ?? true,
    defaultBucketSlug: profile.defaultBucket?.slug ?? "personal",
    buckets: profile.buckets.map((bucket) => ({
      ...bucket,
      isDefault: profile.defaultBucket?.slug === bucket.slug,
    })),
  };
}

export async function updateUserSettings(
  userId: string,
  payload: UpdateSettingsRequest,
): Promise<SettingsResponse> {
  const defaultBucket = await prisma.bucket.findFirst({
    where: {
      userId,
      slug: payload.defaultBucketSlug,
    },
    select: {
      id: true,
    },
  });

  if (!defaultBucket) {
    throw new Error("The selected default bucket could not be found.");
  }

  const profile = await prisma.appProfile.update({
    where: {
      id: userId,
    },
    data: {
      displayName: payload.displayName,
      preferredLanguage: payload.preferredLanguage as PreferredLanguage,
      timezone: payload.timezone,
      preferredCurrency: payload.preferredCurrency as CurrencyCode,
      voiceRepliesEnabled: payload.voiceRepliesEnabled,
      reminderDefaultTime: payload.reminderDefaultTime,
      preferredEntryInput: payload.preferredEntryInput as EntryInputPreference,
      balanceGuardEnabled: payload.balanceGuardEnabled,
      defaultBucketId: defaultBucket.id,
    },
    select: {
      displayName: true,
      email: true,
      preferredLanguage: true,
      timezone: true,
      preferredCurrency: true,
      voiceRepliesEnabled: true,
      reminderDefaultTime: true,
      preferredEntryInput: true,
      balanceGuardEnabled: true,
      defaultBucket: {
        select: {
          slug: true,
        },
      },
      buckets: {
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
        },
        orderBy: [
          {
            kind: "asc",
          },
          {
            name: "asc",
          },
        ],
      },
    },
  });

  return {
    displayName: profile.displayName ?? "",
    email: profile.email ?? null,
    preferredLanguage: profile.preferredLanguage ?? "HINGLISH",
    timezone: profile.timezone ?? "Asia/Kolkata",
    preferredCurrency: profile.preferredCurrency ?? "INR",
    voiceRepliesEnabled: profile.voiceRepliesEnabled ?? true,
    reminderDefaultTime: profile.reminderDefaultTime ?? "09:00",
    preferredEntryInput: profile.preferredEntryInput ?? "TYPING",
    balanceGuardEnabled: profile.balanceGuardEnabled ?? true,
    defaultBucketSlug: profile.defaultBucket?.slug ?? "personal",
    buckets: profile.buckets.map((bucket) => ({
      ...bucket,
      isDefault: profile.defaultBucket?.slug === bucket.slug,
    })),
  };
}
