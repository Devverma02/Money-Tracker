import { prisma } from "@/lib/prisma";
import { buildDeterministicEntryNote } from "@/lib/ledger/entry-note";
import type {
  HistoryEntry,
  HistoryFilterPeriod,
  HistoryFilters,
  HistoryPageData,
} from "@/lib/ledger/history-types";

function getPeriodStart(period: HistoryFilterPeriod) {
  const now = new Date();

  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return start;
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
}

function normalizeFilters(input?: Partial<HistoryFilters>): HistoryFilters {
  const page = Number(input?.page ?? 1);
  const pageSize = Number(input?.pageSize ?? 20);
  const period = input?.period ?? "all";

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 && pageSize <= 50 ? pageSize : 20,
    entryType: input?.entryType?.trim() ?? "",
    period:
      period === "today" || period === "week" || period === "month" ? period : "all",
  };
}

function mapHistoryEntry(entry: {
  id: string;
  amount: { toString(): string };
  entryType: string;
  category: string | null;
  entryDate: Date;
  personName: string | null;
  note: string | null;
  sourceText: string | null;
  createdAt: Date;
  corrections: Array<{ createdAt: Date }>;
}): HistoryEntry {
  return {
    id: entry.id,
    amount: Number(entry.amount),
    entryType: entry.entryType,
    category: entry.category,
    entryDate: entry.entryDate.toISOString(),
    personName: entry.personName,
    note:
      !entry.note || entry.note === entry.sourceText
        ? buildDeterministicEntryNote({
            entryType: entry.entryType,
            amount: Number(entry.amount),
            entryDate: entry.entryDate.toISOString().slice(0, 10),
            personName: entry.personName,
            category: entry.category,
            sourceText: entry.sourceText,
          })
        : entry.note,
    sourceText: entry.sourceText,
    correctionCount: entry.corrections.length,
    lastCorrectionAt: entry.corrections[0]?.createdAt.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function getRecentEntries(
  userId: string,
  input?: Partial<HistoryFilters>,
): Promise<HistoryPageData> {
  const filters = normalizeFilters(input);
  const periodStart = getPeriodStart(filters.period);
  const where = {
    userId,
    ...(filters.entryType ? { entryType: filters.entryType as never } : {}),
    ...(periodStart ? { entryDate: { gte: periodStart } } : {}),
  };

  const [totalCount, entries] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      select: {
        id: true,
        amount: true,
        entryType: true,
        category: true,
        entryDate: true,
        personName: true,
        note: true,
        sourceText: true,
        createdAt: true,
        corrections: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return {
    entries: entries.map(mapHistoryEntry),
    totalCount,
    page: Math.min(filters.page, totalPages),
    pageSize: filters.pageSize,
    totalPages,
    filters,
  };
}
