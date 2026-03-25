import { EntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTrackedBalanceBreakdown } from "@/lib/ledger/tracked-balance";
import { formatMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";
import { getOpeningLoanPositions } from "@/lib/setup/setup";
import { getDashboardDateRanges } from "@/lib/summaries/date-range";
import type {
  DashboardSummary,
  PendingLoanSummary,
  PeriodSummary,
} from "@/lib/summaries/types";

const positiveCashEntryTypes = new Set<EntryType>([
  EntryType.INCOME,
  EntryType.LOAN_TAKEN,
  EntryType.LOAN_RECEIVED_BACK,
]);

const negativeCashEntryTypes = new Set<EntryType>([
  EntryType.EXPENSE,
  EntryType.LOAN_GIVEN,
  EntryType.LOAN_REPAID,
  EntryType.SAVINGS_DEPOSIT,
]);

function toNumber(value: { toNumber: () => number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function buildPeriodSummary(
  label: string,
  rangeStart: Date,
  rangeEndExclusive: Date,
  entries: Array<{
    amount: { toNumber: () => number };
    entryType: EntryType;
  }>,
): PeriodSummary {
  let cashInTotal = 0;
  let cashOutTotal = 0;

  for (const entry of entries) {
    const amount = toNumber(entry.amount);

    if (positiveCashEntryTypes.has(entry.entryType)) {
      cashInTotal += amount;
    }

    if (negativeCashEntryTypes.has(entry.entryType)) {
      cashOutTotal += amount;
    }
  }

  return {
    label,
    rangeStart: rangeStart.toISOString(),
    rangeEndExclusive: rangeEndExclusive.toISOString(),
    cashInTotal,
    cashOutTotal,
    netCashMovement: cashInTotal - cashOutTotal,
    entryCount: entries.length,
  };
}

function computePendingLoans(
  entries: Array<{
    personName: string | null;
    amount: { toNumber: () => number };
    entryType: EntryType;
  }>,
  openingPositions: Array<{
    personName: string;
    amount: { toNumber: () => number };
    direction: "RECEIVABLE" | "PAYABLE";
  }> = [],
) {
  const people = new Map<string, PendingLoanSummary>();

  for (const entry of entries) {
    if (!entry.personName) {
      continue;
    }

    const personName = entry.personName.trim();
    const current = people.get(personName) ?? {
      personName,
      receivable: 0,
      payable: 0,
    };
    const amount = toNumber(entry.amount);

    if (entry.entryType === EntryType.LOAN_GIVEN) {
      current.receivable += amount;
    }

    if (entry.entryType === EntryType.LOAN_RECEIVED_BACK) {
      current.receivable -= amount;
    }

    if (entry.entryType === EntryType.LOAN_TAKEN) {
      current.payable += amount;
    }

    if (entry.entryType === EntryType.LOAN_REPAID) {
      current.payable -= amount;
    }

    people.set(personName, current);
  }

  for (const item of openingPositions) {
    const personName = item.personName.trim();
    const current = people.get(personName) ?? {
      personName,
      receivable: 0,
      payable: 0,
    };
    const amount = toNumber(item.amount);

    if (item.direction === "RECEIVABLE") {
      current.receivable += amount;
    } else {
      current.payable += amount;
    }

    people.set(personName, current);
  }

  return Array.from(people.values())
    .map((item) => ({
      ...item,
      receivable: Math.max(item.receivable, 0),
      payable: Math.max(item.payable, 0),
    }))
    .filter((item) => item.receivable > 0 || item.payable > 0)
    .sort((left, right) => right.receivable + right.payable - (left.receivable + left.payable));
}

function computeTopSpendingCategory(
  entries: Array<{
    amount: { toNumber: () => number };
    entryType: EntryType;
    category: string | null;
  }>,
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    if (entry.entryType !== EntryType.EXPENSE || !entry.category) {
      continue;
    }

    totals.set(entry.category, (totals.get(entry.category) ?? 0) + toNumber(entry.amount));
  }

  let winner: { category: string; amount: number } | null = null;

  for (const [category, amount] of totals.entries()) {
    if (!winner || amount > winner.amount) {
      winner = { category, amount };
    }
  }

  return winner;
}

function buildInsightText(summary: DashboardSummary, currency: CurrencyCodeValue) {
  if (
    summary.today.entryCount === 0 &&
    summary.week.entryCount === 0 &&
    summary.month.entryCount === 0
  ) {
    return "No summary data yet. Save a few entries and the dashboard will start showing real numbers here.";
  }

  if (summary.pendingLoans.length > 0) {
    const topLoan = summary.pendingLoans[0];

    if (topLoan.receivable > 0) {
      return `You still need to receive ${formatMoney(topLoan.receivable, currency)} from ${topLoan.personName}. Keep that pending loan visible.`;
    }

    return `You still need to pay ${formatMoney(topLoan.payable, currency)} to ${topLoan.personName}. Keep it in view while planning upcoming cash outflows.`;
  }

  if (summary.topSpendingCategory) {
    return `Your highest spending this month is in ${summary.topSpendingCategory.category}, with a total of ${formatMoney(summary.topSpendingCategory.amount, currency)}.`;
  }

  return `This month your net cash movement is ${formatMoney(summary.month.netCashMovement, currency)}. This is not a wallet balance, only the net effect of saved entries.`;
}

export async function getDashboardSummary(
  userId: string,
  timeZone: string,
  currency: CurrencyCodeValue = "INR",
): Promise<DashboardSummary> {
  const ranges = getDashboardDateRanges(timeZone);
  const earliestStart = ranges.month.start;

  const [todayEntries, weekEntries, monthEntries, loanEntries, openingLoans, trackedBalance] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: ranges.today.start,
          lt: ranges.today.endExclusive,
        },
      },
      select: {
        amount: true,
        entryType: true,
      },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: ranges.week.start,
          lt: ranges.week.endExclusive,
        },
      },
      select: {
        amount: true,
        entryType: true,
      },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        entryDate: {
          gte: earliestStart,
          lt: ranges.month.endExclusive,
        },
      },
      select: {
        amount: true,
        entryType: true,
        category: true,
      },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        entryType: {
          in: [
            EntryType.LOAN_GIVEN,
            EntryType.LOAN_TAKEN,
            EntryType.LOAN_RECEIVED_BACK,
            EntryType.LOAN_REPAID,
          ],
        },
      },
      select: {
        personName: true,
        amount: true,
        entryType: true,
      },
    }),
    getOpeningLoanPositions(userId),
    getTrackedBalanceBreakdown(userId, timeZone),
  ]);

  const today = buildPeriodSummary(
    ranges.today.label,
    ranges.today.start,
    ranges.today.endExclusive,
    todayEntries,
  );
  const week = buildPeriodSummary(
    ranges.week.label,
    ranges.week.start,
    ranges.week.endExclusive,
    weekEntries,
  );
  const month = buildPeriodSummary(
    ranges.month.label,
    ranges.month.start,
    ranges.month.endExclusive,
    monthEntries,
  );
  const pendingLoans = computePendingLoans(loanEntries, openingLoans);
  const topSpendingCategory = computeTopSpendingCategory(monthEntries);

  const summary: DashboardSummary = {
    trackedBalance: {
      openingBalance: trackedBalance.openingBalance,
      currentBalance: trackedBalance.currentBalance,
      cashInSinceSetup: trackedBalance.cashInSinceSetup,
      cashOutSinceSetup: trackedBalance.cashOutSinceSetup,
    },
    today,
    week,
    month,
    pendingLoans,
    topSpendingCategory,
    monthlyReport: {
      cashInTotal: month.cashInTotal,
      cashOutTotal: month.cashOutTotal,
      topSpendingCategory,
      topReceivablePerson:
        pendingLoans.find((item) => item.receivable > 0) ?? null,
      topPayablePerson:
        pendingLoans.find((item) => item.payable > 0) ?? null,
    },
    insightText: "",
  };

  return {
    ...summary,
    insightText: buildInsightText(summary, currency),
  };
}
