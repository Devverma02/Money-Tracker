import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { EntryType } from "@prisma/client";

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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        userId: user.id,
        entryDate: { gte: thirtyDaysAgo },
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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (let d = 0; d < 7; d++) {
      const day = new Date(sevenDaysAgo.getTime() + (d + 1) * 24 * 60 * 60 * 1000);
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
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
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
      if (entryDate >= sevenDaysAgo) {
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
      const currentMonth = now.getMonth();
      const entryMonth = entryDate.getMonth();

      if (
        entry.entryType === EntryType.EXPENSE &&
        entryMonth === currentMonth &&
        entryDate.getFullYear() === now.getFullYear()
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
