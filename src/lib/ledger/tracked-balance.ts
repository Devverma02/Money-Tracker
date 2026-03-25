import { EntryType } from "@prisma/client";
import type { ParsedAction } from "@/lib/ai/parse-contract";
import { prisma } from "@/lib/prisma";
import { getDashboardDateRanges } from "@/lib/summaries/date-range";
import { toLedgerEntryType } from "@/lib/ledger/entry-types";

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

type TrackedBalanceBreakdown = {
  currentBalance: number;
  openingBalance: number;
  cashInSinceSetup: number;
  cashOutSinceSetup: number;
  balanceGuardEnabled: boolean;
};

function toNumber(value: { toNumber: () => number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}

export async function getTrackedBalanceBreakdown(
  userId: string,
  timeZone: string,
): Promise<TrackedBalanceBreakdown> {
  const ranges = getDashboardDateRanges(timeZone);
  const [profile, entries] = await Promise.all([
    prisma.appProfile.findUnique({
      where: {
        id: userId,
      },
      select: {
        openingBalance: true,
        balanceGuardEnabled: true,
      },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        entryDate: {
          lt: ranges.today.endExclusive,
        },
        entryType: {
          in: Array.from(
            new Set([...positiveCashEntryTypes, ...negativeCashEntryTypes]),
          ),
        },
      },
      select: {
        amount: true,
        entryType: true,
      },
    }),
  ]);

  const openingBalance = profile ? toNumber(profile.openingBalance) : 0;
  let cashInSinceSetup = 0;
  let cashOutSinceSetup = 0;

  for (const entry of entries) {
    const amount = toNumber(entry.amount);

    if (positiveCashEntryTypes.has(entry.entryType)) {
      cashInSinceSetup += amount;
    }

    if (negativeCashEntryTypes.has(entry.entryType)) {
      cashOutSinceSetup += amount;
    }
  }

  return {
    openingBalance,
    cashInSinceSetup,
    cashOutSinceSetup,
    currentBalance: openingBalance + cashInSinceSetup - cashOutSinceSetup,
    balanceGuardEnabled: profile?.balanceGuardEnabled ?? true,
  };
}

function affectsTrackedBalance(
  action: ParsedAction,
  todayEndExclusive: Date,
) {
  const ledgerEntryType = toLedgerEntryType(action.entryType);

  if (!ledgerEntryType || action.amount === null || action.amount === undefined) {
    return 0;
  }

  if (!action.resolvedDate) {
    return 0;
  }

  const actionDate = new Date(action.resolvedDate);
  if (Number.isNaN(actionDate.getTime()) || actionDate >= todayEndExclusive) {
    return 0;
  }

  if (positiveCashEntryTypes.has(ledgerEntryType)) {
    return action.amount;
  }

  if (negativeCashEntryTypes.has(ledgerEntryType)) {
    return -action.amount;
  }

  return 0;
}

export async function getProjectedTrackedBalanceAfterSave(params: {
  userId: string;
  timeZone: string;
  actions: ParsedAction[];
}) {
  const { userId, timeZone, actions } = params;
  const ranges = getDashboardDateRanges(timeZone);
  const current = await getTrackedBalanceBreakdown(userId, timeZone);

  const delta = actions.reduce(
    (sum, action) => sum + affectsTrackedBalance(action, ranges.today.endExclusive),
    0,
  );

  return {
    ...current,
    projectedBalance: current.currentBalance + delta,
    delta,
  };
}
