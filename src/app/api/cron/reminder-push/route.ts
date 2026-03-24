import { ReminderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWebPush } from "@/lib/push/web-push";
import { refreshAllReminderStatuses } from "@/lib/reminders/reminder-board";
import { serverEnv } from "@/lib/env/server";

function isAuthorized(request: Request) {
  if (!serverEnv.CRON_SECRET) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${serverEnv.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await refreshAllReminderStatuses();

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);

  const reminders = await prisma.reminder.findMany({
    where: {
      status: {
        in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED, ReminderStatus.OVERDUE],
      },
      OR: [
        {
          status: ReminderStatus.PENDING,
          dueAt: {
            lte: windowEnd,
          },
        },
        {
          status: ReminderStatus.SNOOZED,
          snoozeUntil: {
            lte: windowEnd,
          },
        },
        {
          status: ReminderStatus.OVERDUE,
          dueAt: {
            lte: windowEnd,
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      linkedPerson: true,
      dueAt: true,
      snoozeUntil: true,
      status: true,
    },
    take: 200,
    orderBy: {
      dueAt: "asc",
    },
  });

  if (reminders.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, staleSubscriptions: 0 });
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        in: Array.from(new Set(reminders.map((reminder) => reminder.userId))),
      },
    },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  const subscriptionsByUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const list = subscriptionsByUser.get(subscription.userId) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.userId, list);
  }

  let sent = 0;
  let skipped = 0;
  let staleSubscriptions = 0;

  for (const reminder of reminders) {
    const dueAtSnapshot = reminder.snoozeUntil ?? reminder.dueAt;
    const userSubscriptions = subscriptionsByUser.get(reminder.userId) ?? [];

    for (const subscription of userSubscriptions) {
      const alreadySent = await prisma.reminderPushDelivery.findUnique({
        where: {
          reminderId_pushSubscriptionId_dueAtSnapshot: {
            reminderId: reminder.id,
            pushSubscriptionId: subscription.id,
            dueAtSnapshot,
          },
        },
        select: {
          id: true,
        },
      });

      if (alreadySent) {
        skipped += 1;
        continue;
      }

      try {
        await sendWebPush({
          subscription,
          payload: {
            title: "MoneyManage reminder",
            body: reminder.linkedPerson
              ? `${reminder.title} • ${reminder.linkedPerson}`
              : reminder.title,
            tag: `reminder-${reminder.id}`,
            url: "/dashboard?section=reminders",
          },
        });

        await prisma.$transaction([
          prisma.reminderPushDelivery.create({
            data: {
              reminderId: reminder.id,
              pushSubscriptionId: subscription.id,
              dueAtSnapshot,
            },
          }),
          prisma.pushSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              lastSuccessAt: new Date(),
            },
          }),
        ]);

        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: {
              id: subscription.id,
            },
          });
          staleSubscriptions += 1;
          continue;
        }

        throw error;
      }
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    staleSubscriptions,
    remindersChecked: reminders.length,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
