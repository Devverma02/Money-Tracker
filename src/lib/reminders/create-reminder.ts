import { ReminderStatus } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import type { CreateReminderRequest } from "@/lib/reminders/reminder-contract";

async function resolveBucketId(userId: string, bucketSlug?: string) {
  if (bucketSlug) {
    const existingBucket = await prisma.bucket.findFirst({
      where: {
        userId,
        slug: bucketSlug,
      },
      select: {
        id: true,
      },
    });

    if (existingBucket) {
      return existingBucket.id;
    }
  }

  const profile = await prisma.appProfile.findUnique({
    where: {
      id: userId,
    },
    select: {
      defaultBucketId: true,
    },
  });

  return profile?.defaultBucketId ?? null;
}

export async function createReminder(params: {
  user: User;
  payload: CreateReminderRequest;
}) {
  const { user, payload } = params;
  const dueAt = new Date(payload.dueAt);

  if (Number.isNaN(dueAt.getTime())) {
    throw new Error("The reminder date could not be understood.");
  }

  if (dueAt <= new Date()) {
    throw new Error("The reminder must be scheduled in the future.");
  }

  const bucketId = await resolveBucketId(user.id, payload.bucket);

  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id,
      bucketId,
      title: payload.title,
      linkedPerson: payload.linkedPerson,
      dueAt,
      status: ReminderStatus.PENDING,
    },
    select: {
      id: true,
    },
  });

  return {
    created: true as const,
    reminderId: reminder.id,
    message: "The reminder was created successfully.",
  };
}
