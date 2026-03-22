import { EntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecurringSuggestion } from "@/lib/summaries/types";

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sameMonth(left: Date, right: Date) {
  return monthKey(left) === monthKey(right);
}

function buildSignature(entry: {
  entryType: EntryType;
  category: string | null;
  personName: string | null;
  amount: { toNumber: () => number };
}) {
  return [
    entry.entryType,
    entry.category?.trim().toLowerCase() ?? "",
    entry.personName?.trim().toLowerCase() ?? "",
    Math.round(entry.amount.toNumber()),
  ].join("|");
}

function buildSuggestedText(entry: {
  entryType: EntryType;
  category: string | null;
  personName: string | null;
  amount: { toNumber: () => number };
}) {
  const amount = entry.amount.toNumber();

  if (entry.entryType === EntryType.INCOME) {
    return `Received ${entry.category ?? "income"} of ${amount}`;
  }

  if (entry.entryType === EntryType.SAVINGS_DEPOSIT) {
    return `Saved ${amount} in ${entry.category ?? "savings"}`;
  }

  if (entry.personName) {
    return `Paid ${entry.personName} ${amount} for ${entry.category ?? "expense"}`;
  }

  return `Spent ${amount} on ${entry.category ?? "expense"}`;
}

function buildTitle(entry: {
  entryType: EntryType;
  category: string | null;
  personName: string | null;
}) {
  if (entry.entryType === EntryType.INCOME) {
    return entry.category ? `Recurring ${entry.category}` : "Recurring income";
  }

  if (entry.entryType === EntryType.SAVINGS_DEPOSIT) {
    return entry.category ? `Recurring ${entry.category}` : "Recurring savings";
  }

  if (entry.category) {
    return entry.category;
  }

  if (entry.personName) {
    return entry.personName;
  }

  return "Recurring expense";
}

export async function getRecurringSuggestions(
  userId: string,
  timeZone: string,
): Promise<RecurringSuggestion[]> {
  void timeZone;
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      userId,
      entryType: {
        in: [EntryType.EXPENSE, EntryType.INCOME, EntryType.SAVINGS_DEPOSIT],
      },
      entryDate: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      id: true,
      amount: true,
      entryType: true,
      category: true,
      personName: true,
      entryDate: true,
    },
    orderBy: {
      entryDate: "desc",
    },
  });

  const groups = new Map<
    string,
    {
      example: (typeof entries)[number];
      months: Set<string>;
      dates: Date[];
      currentMonthCount: number;
    }
  >();

  for (const entry of entries) {
    const signature = buildSignature(entry);
    const existing = groups.get(signature) ?? {
      example: entry,
      months: new Set<string>(),
      dates: [],
      currentMonthCount: 0,
    };

    existing.example = existing.example ?? entry;
    existing.months.add(monthKey(entry.entryDate));
    existing.dates.push(entry.entryDate);

    if (sameMonth(entry.entryDate, now)) {
      existing.currentMonthCount += 1;
    }

    groups.set(signature, existing);
  }

  const suggestions = Array.from(groups.values())
    .filter((group) => group.months.size >= 2 && group.currentMonthCount === 0)
    .map((group) => {
      const days = group.dates.map((date) => date.getUTCDate()).sort((left, right) => left - right);
      const medianDay = days[Math.floor(days.length / 2)] ?? 1;
      const nextExpectedDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), medianDay));

      return {
        id: buildSignature(group.example),
        title: buildTitle(group.example),
        suggestedText: buildSuggestedText(group.example),
        amount: group.example.amount.toNumber(),
        entryType:
          group.example.entryType === EntryType.INCOME
            ? "income"
            : group.example.entryType === EntryType.SAVINGS_DEPOSIT
              ? "savings_deposit"
              : "expense",
        category: group.example.category,
        personName: group.example.personName,
        nextExpectedDate: nextExpectedDate.toISOString(),
        patternMonths: group.months.size,
      } satisfies RecurringSuggestion;
    })
    .sort((left, right) => left.nextExpectedDate.localeCompare(right.nextExpectedDate))
    .slice(0, 6);

  return suggestions;
}
