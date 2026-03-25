import { EntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AskAiInterpretation } from "@/lib/ai/ask-interpret-contract";
import { getTrackedBalanceBreakdown } from "@/lib/ledger/tracked-balance";
import { getOpeningLoanPositions } from "@/lib/setup/setup";
import {
  resolveAskDateRange,
  type ResolvedAskPeriod,
} from "@/lib/dates/natural-date";
import { containsNormalizedTerm } from "@/lib/text/unicode-search";

export type AskAiFacts = {
  question: string;
  resolvedPeriod: ResolvedAskPeriod;
  resolvedPeriodLabel: string;
  appliedPersonFilter: string | null;
  appliedCategoryFilter: string | null;
  trackedBalance: {
    openingBalance: number;
    currentBalance: number;
    cashInSinceSetup: number;
    cashOutSinceSetup: number;
  };
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
  totalMatchingEntries: number;
};

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

const categoryAliases: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "ghar", patterns: [/\b(grocery|groceries|ration|sabzi|doodh|ghar)\b/i] },
  { canonical: "travel", patterns: [/\b(travel|petrol|diesel|fuel|auto|cab)\b/i] },
  { canonical: "rent", patterns: [/\b(rent|kiraya)\b/i] },
  { canonical: "health", patterns: [/\b(health|medicine|doctor|hospital|dawai)\b/i] },
  { canonical: "income", patterns: [/\b(income|salary|aamdani|kamai)\b/i] },
  { canonical: "savings", patterns: [/\b(savings|saving|bachat|deposit)\b/i] },
];

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEntityName(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\b(ji|bhai|sir|madam|bhabhi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return titleCase(cleaned.toLowerCase());
}

function computeSummary(
  label: string,
  entries: Array<{ amount: number; entryType: EntryType }>,
) {
  let cashInTotal = 0;
  let cashOutTotal = 0;

  for (const entry of entries) {
    if (positiveCashEntryTypes.has(entry.entryType)) {
      cashInTotal += entry.amount;
    }

    if (negativeCashEntryTypes.has(entry.entryType)) {
      cashOutTotal += entry.amount;
    }
  }

  return {
    label,
    cashInTotal,
    cashOutTotal,
    netCashMovement: cashInTotal - cashOutTotal,
    entryCount: entries.length,
  };
}

function computePendingLoans(
  entries: Array<{
    personName: string | null;
    amount: number;
    entryType: EntryType;
  }>,
  openingPositions: Array<{
    personName: string;
    amount: number;
    direction: "RECEIVABLE" | "PAYABLE";
  }> = [],
) {
  const people = new Map<string, { personName: string; receivable: number; payable: number }>();

  for (const entry of entries) {
    const personName = normalizeEntityName(entry.personName);

    if (!personName) {
      continue;
    }

    const current = people.get(personName) ?? {
      personName,
      receivable: 0,
      payable: 0,
    };

    if (entry.entryType === EntryType.LOAN_GIVEN) {
      current.receivable += entry.amount;
    }

    if (entry.entryType === EntryType.LOAN_RECEIVED_BACK) {
      current.receivable -= entry.amount;
    }

    if (entry.entryType === EntryType.LOAN_TAKEN) {
      current.payable += entry.amount;
    }

    if (entry.entryType === EntryType.LOAN_REPAID) {
      current.payable -= entry.amount;
    }

    people.set(personName, current);
  }

  for (const item of openingPositions) {
    const personName = normalizeEntityName(item.personName);

    if (!personName) {
      continue;
    }

    const current = people.get(personName) ?? {
      personName,
      receivable: 0,
      payable: 0,
    };

    if (item.direction === "RECEIVABLE") {
      current.receivable += item.amount;
    } else {
      current.payable += item.amount;
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
    amount: number;
    entryType: EntryType;
    category: string | null;
  }>,
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    if (entry.entryType !== EntryType.EXPENSE || !entry.category) {
      continue;
    }

    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
  }

  let winner: { category: string; amount: number } | null = null;

  for (const [category, amount] of totals.entries()) {
    if (!winner || amount > winner.amount) {
      winner = { category, amount };
    }
  }

  return winner;
}

function findQuestionPersonFilter(question: string, personNames: string[]) {
  for (const personName of personNames) {
    if (containsNormalizedTerm(question, personName)) {
      return personName;
    }
  }

  return null;
}

function findQuestionCategoryFilter(question: string, categories: string[]) {
  for (const category of categories) {
    if (containsNormalizedTerm(question, category)) {
      return category;
    }
  }

  const aliasMatch = categoryAliases.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(question)),
  );

  return aliasMatch?.canonical ?? null;
}

export async function getAskAiFacts(params: {
  userId: string;
  question: string;
  timeZone: string;
  interpretation?: AskAiInterpretation | null;
}) {
  const { userId, question, timeZone, interpretation } = params;
  const resolvedRange = resolveAskDateRange(
    interpretation?.periodQuery?.trim() || question,
    timeZone,
  );
  const [rawEntries, openingPositions, trackedBalance] = await Promise.all([
    prisma.ledgerEntry.findMany({
    where: {
      userId,
      ...(resolvedRange.start && resolvedRange.endExclusive
        ? {
            entryDate: {
              gte: resolvedRange.start,
              lt: resolvedRange.endExclusive,
            },
          }
        : {}),
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
    }),
    getOpeningLoanPositions(userId),
    getTrackedBalanceBreakdown(userId, timeZone),
  ]);

  const entries = rawEntries.map((entry) => ({
    amount: entry.amount.toNumber(),
    entryType: entry.entryType,
    category: entry.category,
    personName: normalizeEntityName(entry.personName),
    entryDate: entry.entryDate,
    note: entry.note,
  }));

  const appliedPersonFilter =
    interpretation?.personFilter?.trim() ||
    findQuestionPersonFilter(
      question,
      Array.from(
        new Set(
          entries
            .map((entry) => entry.personName)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    );
  const appliedCategoryFilter =
    interpretation?.categoryFilter?.trim() ||
    findQuestionCategoryFilter(
      question,
      Array.from(
        new Set(
          entries
            .map((entry) => entry.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    );

  const filteredEntries = entries.filter((entry) => {
    const personPass = appliedPersonFilter ? entry.personName === appliedPersonFilter : true;
    const categoryPass = appliedCategoryFilter ? entry.category === appliedCategoryFilter : true;
    return personPass && categoryPass;
  });
  const filteredOpeningPositions = openingPositions
    .map((item) => ({
      personName: item.personName,
      amount: item.amount.toNumber(),
      direction: item.direction,
    }))
    .filter((item) =>
      appliedPersonFilter
        ? normalizeEntityName(item.personName) === appliedPersonFilter
        : true,
    );

  const summaryLabelParts = [resolvedRange.label];

  if (appliedPersonFilter) {
    summaryLabelParts.push(appliedPersonFilter);
  }

  if (appliedCategoryFilter) {
    summaryLabelParts.push(titleCase(appliedCategoryFilter));
  }

  return {
    question,
    resolvedPeriod: resolvedRange.resolvedPeriod,
    resolvedPeriodLabel: resolvedRange.label,
    appliedPersonFilter,
    appliedCategoryFilter,
    trackedBalance: {
      openingBalance: trackedBalance.openingBalance,
      currentBalance: trackedBalance.currentBalance,
      cashInSinceSetup: trackedBalance.cashInSinceSetup,
      cashOutSinceSetup: trackedBalance.cashOutSinceSetup,
    },
    summary: computeSummary(summaryLabelParts.join(" | "), filteredEntries),
    pendingLoans: computePendingLoans(filteredEntries, filteredOpeningPositions).slice(0, 8),
    topSpendingCategory: computeTopSpendingCategory(filteredEntries),
    recentEntries: filteredEntries.slice(0, 8).map((entry) => ({
      amount: entry.amount,
      entryType: entry.entryType,
      category: entry.category,
      personName: entry.personName,
      entryDate: entry.entryDate.toISOString(),
      note: entry.note,
    })),
    totalMatchingEntries: filteredEntries.length,
  } satisfies AskAiFacts;
}
