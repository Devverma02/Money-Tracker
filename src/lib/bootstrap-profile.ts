import { BucketKind, CurrencyCode, PreferredLanguage } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

function resolveDisplayName(user: User) {
  const metadataName =
    user.user_metadata.full_name ??
    user.user_metadata.name ??
    user.user_metadata.user_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Naya user";
}

export async function ensureAppProfile(user: User) {
  const displayName = resolveDisplayName(user);

  const profile = await prisma.appProfile.upsert({
    where: {
      id: user.id,
    },
    update: {
      email: user.email ?? null,
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      displayName,
      preferredLanguage: PreferredLanguage.HINGLISH,
      timezone: "Asia/Kolkata",
      preferredCurrency: CurrencyCode.INR,
    },
  });

  const hydratedProfile =
    profile.displayName && profile.displayName.trim().length > 0
      ? profile
      : await prisma.appProfile.update({
          where: {
            id: user.id,
          },
          data: {
            displayName,
          },
        });

  const bucket = await prisma.bucket.upsert({
    where: {
      userId_slug: {
        userId: user.id,
        slug: "personal",
      },
    },
    update: {
      name: "Personal",
      kind: BucketKind.PERSONAL,
    },
    create: {
      userId: user.id,
      name: "Personal",
      slug: "personal",
      kind: BucketKind.PERSONAL,
    },
  });

  if (hydratedProfile.defaultBucketId === bucket.id) {
    return hydratedProfile;
  }

  return prisma.appProfile.update({
    where: {
      id: user.id,
    },
    data: {
      defaultBucketId: bucket.id,
    },
  });
}
