import { prisma } from "@/lib/prisma";
import { buildDeterministicEntryNote } from "@/lib/ledger/entry-note";
import type {
  HistoryEntry,
  HistoryFilterPeriod,
  HistoryFilters,
  HistoryPageData,
} from "@/lib/ledger/history-types";

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);

  return new Date(utcGuess.getTime() - offset);
}

function getPeriodStart(period: HistoryFilterPeriod, timeZone: string) {
  const now = new Date();
  const zonedNow = getZonedDateParts(now, timeZone);

  if (period === "today") {
    return zonedDateTimeToUtc(
      zonedNow.year,
      zonedNow.month,
      zonedNow.day,
      timeZone,
    );
  }

  if (period === "week") {
    const startDay = new Date(
      Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day),
    );
    const day = startDay.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const mondayUtc = new Date(
      Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day - diff),
    );

    return zonedDateTimeToUtc(
      mondayUtc.getUTCFullYear(),
      mondayUtc.getUTCMonth() + 1,
      mondayUtc.getUTCDate(),
      timeZone,
    );
  }

  if (period === "month") {
    return zonedDateTimeToUtc(zonedNow.year, zonedNow.month, 1, timeZone);
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
  timeZone: string,
  input?: Partial<HistoryFilters>,
): Promise<HistoryPageData> {
  const filters = normalizeFilters(input);
  const periodStart = getPeriodStart(filters.period, timeZone);
  const where = {
    userId,
    ...(filters.entryType ? { entryType: filters.entryType as never } : {}),
    ...(periodStart ? { entryDate: { gte: periodStart } } : {}),
  };

  const totalCount = await prisma.ledgerEntry.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const safePage = Math.min(filters.page, totalPages);
  const entries =
    totalCount === 0
      ? []
      : await prisma.ledgerEntry.findMany({
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
      skip: (safePage - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: {
        createdAt: "desc",
      },
    });

  return {
    entries: entries.map(mapHistoryEntry),
    totalCount,
    page: safePage,
    pageSize: filters.pageSize,
    totalPages,
    filters: {
      ...filters,
      page: safePage,
    },
  };
}
