import { EntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveAskDateRange,
  type ResolvedAskPeriod,
} from "@/lib/dates/natural-date";

export type AskAiFacts = {
  question: string;
  resolvedPeriod: ResolvedAskPeriod;
  resolvedPeriodLabel: string;
  appliedPersonFilter: string | null;
  appliedCategoryFilter: string | null;
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

function normalizeFreeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

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
  const normalizedQuestion = normalizeFreeText(question);

  for (const personName of personNames) {
    const normalizedPersonName = normalizeFreeText(personName);

    if (normalizedPersonName && normalizedQuestion.includes(normalizedPersonName)) {
      return personName;
    }
  }

  return null;
}

function findQuestionCategoryFilter(question: string, categories: string[]) {
  const normalizedQuestion = normalizeFreeText(question);

  for (const category of categories) {
    const normalizedCategory = normalizeFreeText(category);

    if (normalizedCategory && normalizedQuestion.includes(normalizedCategory)) {
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
}) {
  const { userId, question, timeZone } = params;
  const resolvedRange = resolveAskDateRange(question, timeZone);
  const rawEntries = await prisma.ledgerEntry.findMany({
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
  });

  const entries = rawEntries.map((entry) => ({
    amount: entry.amount.toNumber(),
    entryType: entry.entryType,
    category: entry.category,
    personName: normalizeEntityName(entry.personName),
    entryDate: entry.entryDate,
    note: entry.note,
  }));

  const appliedPersonFilter = findQuestionPersonFilter(
    question,
    Array.from(
      new Set(
        entries
          .map((entry) => entry.personName)
          .filter((value): value is string => Boolean(value)),
      ),
    ),
  );
  const appliedCategoryFilter = findQuestionCategoryFilter(
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
    summary: computeSummary(summaryLabelParts.join(" | "), filteredEntries),
    pendingLoans: computePendingLoans(filteredEntries).slice(0, 8),
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
