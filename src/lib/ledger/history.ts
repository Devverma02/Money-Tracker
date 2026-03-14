import { prisma } from "@/lib/prisma";
import type { HistoryEntry } from "@/lib/ledger/history-types";

export async function getRecentEntries(userId: string): Promise<HistoryEntry[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      userId,
    },
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
    take: 20,
    orderBy: {
      createdAt: "desc",
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    amount: Number(entry.amount),
    entryType: entry.entryType,
    category: entry.category,
    entryDate: entry.entryDate.toISOString(),
    personName: entry.personName,
    note: entry.note,
    sourceText: entry.sourceText,
    correctionCount: entry.corrections.length,
    lastCorrectionAt: entry.corrections[0]?.createdAt.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));
}
