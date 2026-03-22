import { ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReminderBoard, ReminderItem } from "@/lib/reminders/types";

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapReminder(reminder: {
  id: string;
  title: string;
  linkedPerson: string | null;
  dueAt: Date;
  snoozeUntil: Date | null;
  status: ReminderStatus;
  linkedEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  bucket: {
    slug: string;
  } | null;
}): ReminderItem {
  const effectiveDueAt = reminder.snoozeUntil ?? reminder.dueAt;

  return {
    id: reminder.id,
    title: reminder.title,
    linkedPerson: reminder.linkedPerson,
    dueAt: reminder.dueAt.toISOString(),
    snoozeUntil: toIsoString(reminder.snoozeUntil),
    effectiveDueAt: effectiveDueAt.toISOString(),
    status: reminder.status,
    isOverdue: reminder.status === ReminderStatus.OVERDUE,
    bucketSlug: reminder.bucket?.slug ?? null,
    linkedEntryId: reminder.linkedEntryId,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

function buildHelperText(board: ReminderBoard) {
  if (!board.nextReminder && board.closedReminders.length === 0) {
    return "No reminders yet. Create one below with a due date to keep the next follow-up visible.";
  }

  if (board.counts.overdue > 0) {
    return `${board.counts.overdue} reminders are overdue. Resolve them first by marking them done, snoozing, or cancelling them.`;
  }

  if (board.nextReminder) {
    return `"${board.nextReminder.title}" is the nearest upcoming reminder. Keep it visible so it does not get missed.`;
  }

  return "Closed reminders look clear. Create a new one or continue tracking the active items.";
}

export async function refreshReminderStatuses(userId: string, now = new Date()) {
  await prisma.$transaction([
    prisma.reminder.updateMany({
      where: {
        userId,
        status: ReminderStatus.PENDING,
        dueAt: {
          lt: now,
        },
      },
      data: {
        status: ReminderStatus.OVERDUE,
      },
    }),
    prisma.reminder.updateMany({
      where: {
        userId,
        status: ReminderStatus.SNOOZED,
        snoozeUntil: {
          lt: now,
        },
      },
      data: {
        status: ReminderStatus.OVERDUE,
        snoozeUntil: null,
      },
    }),
  ]);
}

export async function getReminderBoard(
  userId: string,
  timeZone: string,
): Promise<ReminderBoard> {
  void timeZone;
  await refreshReminderStatuses(userId);

  const activeStatuses = [
    ReminderStatus.PENDING,
    ReminderStatus.SNOOZED,
    ReminderStatus.OVERDUE,
  ] as const;
  const closedStatuses = [ReminderStatus.DONE, ReminderStatus.CANCELLED] as const;

  const reminderSelect = {
    id: true,
    title: true,
    linkedPerson: true,
    dueAt: true,
    snoozeUntil: true,
    status: true,
    linkedEntryId: true,
    createdAt: true,
    updatedAt: true,
    bucket: {
      select: {
        slug: true,
      },
    },
  } as const;

  const [
    activeReminderRows,
    closedReminderRows,
    activeCount,
    overdueCount,
    closedCount,
  ] = await Promise.all([
    prisma.reminder.findMany({
      where: {
        userId,
        status: {
          in: [...activeStatuses],
        },
      },
      select: reminderSelect,
    }),
    prisma.reminder.findMany({
      where: {
        userId,
        status: {
          in: [...closedStatuses],
        },
      },
      select: reminderSelect,
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
    }),
    prisma.reminder.count({
      where: {
        userId,
        status: {
          in: [...activeStatuses],
        },
      },
    }),
    prisma.reminder.count({
      where: {
        userId,
        status: ReminderStatus.OVERDUE,
      },
    }),
    prisma.reminder.count({
      where: {
        userId,
        status: {
          in: [...closedStatuses],
        },
      },
    }),
  ]);

  const activeReminders = activeReminderRows
    .map(mapReminder)
    .filter((item) =>
      item.status === "PENDING" || item.status === "SNOOZED" || item.status === "OVERDUE",
    )
    .sort((left, right) => left.effectiveDueAt.localeCompare(right.effectiveDueAt));
  const closedReminders = closedReminderRows
    .map(mapReminder)
    .filter((item) => item.status === "DONE" || item.status === "CANCELLED")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const board: ReminderBoard = {
    nextReminder: activeReminders[0] ?? null,
    activeReminders: activeReminders.slice(0, 12),
    closedReminders: closedReminders.slice(0, 8),
    counts: {
      active: activeCount,
      overdue: overdueCount,
      closed: closedCount,
    },
    helperText: "",
  };

  return {
    ...board,
    helperText: buildHelperText(board),
  };
}
