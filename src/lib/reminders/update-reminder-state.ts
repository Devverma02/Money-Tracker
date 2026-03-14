import { ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function findReminderForUser(reminderId: string, userId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!reminder) {
    throw new Error("The reminder could not be found.");
  }

  return reminder;
}

export async function markReminderDone(reminderId: string, userId: string) {
  const reminder = await findReminderForUser(reminderId, userId);

  if (reminder.status === ReminderStatus.CANCELLED) {
    throw new Error("A cancelled reminder cannot be marked as done.");
  }

  await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      status: ReminderStatus.DONE,
      snoozeUntil: null,
    },
  });

  return {
    ok: true as const,
    message: "The reminder was marked as done.",
  };
}

export async function snoozeReminder(
  reminderId: string,
  userId: string,
  snoozeUntilRaw: string,
) {
  const reminder = await findReminderForUser(reminderId, userId);

  if (reminder.status === ReminderStatus.DONE || reminder.status === ReminderStatus.CANCELLED) {
    throw new Error("A closed reminder cannot be snoozed.");
  }

  const snoozeUntil = new Date(snoozeUntilRaw);

  if (Number.isNaN(snoozeUntil.getTime())) {
    throw new Error("The snooze time is invalid.");
  }

  if (snoozeUntil <= new Date()) {
    throw new Error("The snooze time must be in the future.");
  }

  await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      status: ReminderStatus.SNOOZED,
      snoozeUntil,
    },
  });

  return {
    ok: true as const,
    message: "The reminder was snoozed.",
  };
}

export async function cancelReminder(reminderId: string, userId: string) {
  const reminder = await findReminderForUser(reminderId, userId);

  if (reminder.status === ReminderStatus.DONE) {
    throw new Error("A completed reminder cannot be cancelled.");
  }

  await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      status: ReminderStatus.CANCELLED,
      snoozeUntil: null,
    },
  });

  return {
    ok: true as const,
    message: "The reminder was cancelled.",
  };
}
