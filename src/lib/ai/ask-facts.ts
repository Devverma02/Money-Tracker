import { EntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { getDashboardDateRanges } from "@/lib/summaries/date-range";

export type AskAiPeriod = "today" | "week" | "month" | "overall";

export type AskAiFacts = {
  question: string;
  resolvedPeriod: AskAiPeriod;
  summary: {
    label: string;
    cashInTotal: number;
    cashOutTotal: number;
    netCashMovement: number;
    entryCount: number;
  };
  pendingLoans: Array<{
    personName: string;
    receivable: number;
    payable: number;
  }>;
  topSpendingCategory: {
    category: string;
    amount: number;
  } | null;
  recentEntries: Array<{
    amount: number;
    entryType: string;
    category: string | null;
    personName: string | null;
    entryDate: string;
    note: string | null;
  }>;
};

export function resolveAskPeriod(question: string): AskAiPeriod {
  const normalized = question.toLowerCase();

  if (/\b(aaj|today)\b/.test(normalized)) {
    return "today";
  }

  if (/\b(week|hafte|hafta|weekly)\b/.test(normalized)) {
    return "week";
  }

  if (/\b(month|mahine|mahina|monthly)\b/.test(normalized)) {
    return "month";
  }

  return "overall";
}

export async function getAskAiFacts(params: {
  userId: string;
  question: string;
  timeZone: string;
}) {
  const { userId, question, timeZone } = params;
  const resolvedPeriod = resolveAskPeriod(question);
  const dashboardSummary = await getDashboardSummary(userId, timeZone);
  const ranges = getDashboardDateRanges(timeZone);

  const periodFilter =
    resolvedPeriod === "today"
      ? {
          gte: ranges.today.start,
          lt: ranges.today.endExclusive,
        }
      : resolvedPeriod === "week"
        ? {
            gte: ranges.week.start,
            lt: ranges.week.endExclusive,
          }
        : resolvedPeriod === "month"
          ? {
              gte: ranges.month.start,
              lt: ranges.month.endExclusive,
            }
          : undefined;

  const recentEntries = await prisma.ledgerEntry.findMany({
    where: {
      userId,
      ...(periodFilter ? { entryDate: periodFilter } : {}),
    },
    select: {
      amount: true,
      entryType: true,
      category: true,
      personName: true,
      entryDate: true,
      note: true,
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 5,
  });

  const categoryTotals = new Map<string, number>();

  for (const entry of recentEntries) {
    if (entry.entryType !== EntryType.EXPENSE || !entry.category) {
      continue;
    }

    categoryTotals.set(
      entry.category,
      (categoryTotals.get(entry.category) ?? 0) + entry.amount.toNumber(),
    );
  }

  let topSpendingCategory: { category: string; amount: number } | null = null;

  for (const [category, amount] of categoryTotals.entries()) {
    if (!topSpendingCategory || amount > topSpendingCategory.amount) {
      topSpendingCategory = { category, amount };
    }
  }

  const chosenSummary =
    resolvedPeriod === "today"
      ? dashboardSummary.today
      : resolvedPeriod === "week"
        ? dashboardSummary.week
        : resolvedPeriod === "month"
          ? dashboardSummary.month
          : {
              label: "Overall",
              cashInTotal: dashboardSummary.month.cashInTotal,
              cashOutTotal: dashboardSummary.month.cashOutTotal,
              netCashMovement: dashboardSummary.month.netCashMovement,
              entryCount: dashboardSummary.month.entryCount,
              rangeStart: dashboardSummary.month.rangeStart,
              rangeEndExclusive: dashboardSummary.month.rangeEndExclusive,
            };

  return {
    question,
    resolvedPeriod,
    summary: {
      label: chosenSummary.label,
      cashInTotal: chosenSummary.cashInTotal,
      cashOutTotal: chosenSummary.cashOutTotal,
      netCashMovement: chosenSummary.netCashMovement,
      entryCount: chosenSummary.entryCount,
    },
    pendingLoans: dashboardSummary.pendingLoans.slice(0, 5),
    topSpendingCategory,
    recentEntries: recentEntries.map((entry) => ({
      amount: entry.amount.toNumber(),
      entryType: entry.entryType,
      category: entry.category,
      personName: entry.personName,
      entryDate: entry.entryDate.toISOString(),
      note: entry.note,
    })),
  } satisfies AskAiFacts;
}
