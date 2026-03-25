import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { EntryType } from "@prisma/client";

function parseOffsetLabel(offsetLabel: string) {
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const offsetLabel =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";

  return parseOffsetLabel(offsetLabel);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const roughUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getTimeZoneOffsetMinutes(roughUtc, timeZone);
  return new Date(roughUtc.getTime() - offsetMinutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getLocalDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(getValue("year")),
    month: Number(getValue("month")),
    day: Number(getValue("day")),
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const timeZone = url.searchParams.get("tz") ?? "Asia/Kolkata";

    const now = new Date();
    const localNow = getLocalDateParts(now, timeZone);
    const currentMonthStart = zonedDateTimeToUtc(
      localNow.year,
      localNow.month,
      1,
      0,
      0,
      0,
      timeZone,
    );
    const nextMonthStart =
      localNow.month === 12
        ? zonedDateTimeToUtc(localNow.year + 1, 1, 1, 0, 0, 0, timeZone)
        : zonedDateTimeToUtc(localNow.year, localNow.month + 1, 1, 0, 0, 0, timeZone);
    const oldestMonthAnchor = new Date(
      Date.UTC(localNow.year, localNow.month - 1 - 3, 1),
    );
    const oldestMonthStart = zonedDateTimeToUtc(
      oldestMonthAnchor.getUTCFullYear(),
      oldestMonthAnchor.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      timeZone,
    );
    const todayStart = zonedDateTimeToUtc(
      localNow.year,
      localNow.month,
      localNow.day,
      0,
      0,
      0,
      timeZone,
    );
    const sevenDaysStart = addDays(todayStart, -6);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        userId: user.id,
        entryDate: { gte: oldestMonthStart },
      },
      select: {
        amount: true,
        entryType: true,
        category: true,
        entryDate: true,
      },
      orderBy: { entryDate: "asc" },
    });

    // Weekly daily spending (last 7 days)
    const dailyMap = new Map<string, { expense: number; income: number }>();
    for (let d = 0; d < 7; d++) {
      const day = addDays(sevenDaysStart, d);
      const key = day.toLocaleDateString("en-IN", {
        timeZone,
        weekday: "short",
        day: "numeric",
      });
      dailyMap.set(key, { expense: 0, income: 0 });
    }

    // Category breakdown (this month)
    const categoryMap = new Map<string, number>();

    // Monthly income vs expense (last 4 months)
    const monthlyMap = new Map<string, { expense: number; income: number }>();

    for (let m = 3; m >= 0; m--) {
      const monthDate = new Date(
        Date.UTC(localNow.year, localNow.month - 1 - m, 1),
      );
      const monthLabel = monthDate.toLocaleDateString("en-IN", {
        timeZone,
        month: "short",
        year: "2-digit",
      });
      monthlyMap.set(monthLabel, { expense: 0, income: 0 });
    }

    for (const entry of entries) {
      const amount = entry.amount.toNumber();
      const entryDate = entry.entryDate;

      // Daily
      if (entryDate >= sevenDaysStart) {
        const dayKey = entryDate.toLocaleDateString("en-IN", {
          timeZone,
          weekday: "short",
          day: "numeric",
        });

        if (dailyMap.has(dayKey)) {
          const existing = dailyMap.get(dayKey)!;

          if (entry.entryType === EntryType.EXPENSE) {
            existing.expense += amount;
          } else if (entry.entryType === EntryType.INCOME) {
            existing.income += amount;
          }
        }
      }

      // Category (this month expenses only)
      if (
        entry.entryType === EntryType.EXPENSE &&
        entryDate >= currentMonthStart &&
        entryDate < nextMonthStart
      ) {
        const category = entry.category ?? "Other";
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
      }

      // Monthly
      const monthLabel = entryDate.toLocaleDateString("en-IN", {
        timeZone,
        month: "short",
        year: "2-digit",
      });

      if (monthlyMap.has(monthLabel)) {
        const existing = monthlyMap.get(monthLabel)!;

        if (entry.entryType === EntryType.EXPENSE) {
          existing.expense += amount;
        } else if (entry.entryType === EntryType.INCOME) {
          existing.income += amount;
        }
      }
    }

    const dailySpending = Array.from(dailyMap.entries()).map(
      ([day, data]) => ({ day, ...data }),
    );

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    const monthlyTrend = Array.from(monthlyMap.entries()).map(
      ([month, data]) => ({ month, ...data }),
    );

    return NextResponse.json({
      dailySpending,
      categoryBreakdown,
      monthlyTrend,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not load chart data." },
      { status: 500 },
    );
  }
}
