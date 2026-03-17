import { EntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDuplicateFingerprint } from "@/lib/ledger/duplicate-fingerprint";
import type { CorrectEntryRequest } from "@/lib/ledger/correction-contract";
import { generateEntryNoteFromLedgerEntry } from "@/lib/ledger/entry-note";
import { toLedgerEntryType } from "@/lib/ledger/entry-types";

type EntrySnapshot = {
  amount: string;
  entryType: EntryType;
  category: string | null;
  entryDate: string;
  personName: string | null;
  note: string | null;
  sourceText: string | null;
  parserConfidence: string | null;
  duplicateFingerprint: string | null;
};

function toEntrySnapshot(entry: {
  amount: Prisma.Decimal;
  entryType: EntryType;
  category: string | null;
  entryDate: Date;
  personName: string | null;
  note: string | null;
  sourceText: string | null;
  parserConfidence: Prisma.Decimal | null;
  duplicateFingerprint: string | null;
}): EntrySnapshot {
  return {
    amount: entry.amount.toString(),
    entryType: entry.entryType,
    category: entry.category,
    entryDate: entry.entryDate.toISOString(),
    personName: entry.personName,
    note: entry.note,
    sourceText: entry.sourceText,
    parserConfidence: entry.parserConfidence?.toString() ?? null,
    duplicateFingerprint: entry.duplicateFingerprint,
  };
}

function normalizeCorrectionEntryType(entryType: CorrectEntryRequest["entryType"]) {
  if (!entryType) {
    return null;
  }

  return toLedgerEntryType(entryType);
}

function toParsedEntryType(entryType: EntryType) {
  const reverseMap: Record<EntryType, string> = {
    EXPENSE: "expense",
    INCOME: "income",
    LOAN_GIVEN: "loan_given",
    LOAN_TAKEN: "loan_taken",
    LOAN_RECEIVED_BACK: "loan_received_back",
    LOAN_REPAID: "loan_repaid",
    SAVINGS_DEPOSIT: "savings_deposit",
    NOTE: "note",
    REMINDER: "note",
  };

  return reverseMap[entryType];
}

function applySnapshotToUpdate(snapshot: EntrySnapshot) {
  return {
    amount: new Prisma.Decimal(snapshot.amount),
    entryType: snapshot.entryType,
    category: snapshot.category,
    entryDate: new Date(snapshot.entryDate),
    personName: snapshot.personName,
    note: snapshot.note,
    sourceText: snapshot.sourceText,
    parserConfidence: snapshot.parserConfidence
      ? new Prisma.Decimal(snapshot.parserConfidence)
      : null,
    duplicateFingerprint: snapshot.duplicateFingerprint,
  };
}

export async function correctEntry(params: {
  userId: string;
  entryId: string;
  changes: CorrectEntryRequest;
}) {
  const { userId, entryId, changes } = params;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existing) {
      throw new Error("The target entry could not be found.");
    }

    const beforeSnapshot = toEntrySnapshot(existing);
    const nextEntryType = normalizeCorrectionEntryType(changes.entryType) ?? existing.entryType;
    const nextAmount = changes.amount ?? Number(existing.amount);
    const nextDate = changes.resolvedDate ?? existing.entryDate.toISOString().slice(0, 10);
    const nextCategory = changes.category ?? existing.category;
    const nextPersonName = changes.personName ?? existing.personName;
    const nextNote =
      changes.note ??
      (await generateEntryNoteFromLedgerEntry({
        entryType: nextEntryType,
        amount: nextAmount,
        entryDate: nextDate,
        personName: nextPersonName,
        category: nextCategory,
        sourceText: existing.sourceText,
      }));

    const updatedEntry = await tx.ledgerEntry.update({
      where: {
        id: entryId,
      },
      data: {
        amount: new Prisma.Decimal(nextAmount),
        entryType: nextEntryType,
        category: nextCategory,
        entryDate: new Date(nextDate),
        personName: nextPersonName,
        note: nextNote,
        duplicateFingerprint: createDuplicateFingerprint({
          userId,
          amount: nextAmount,
          entryType: toParsedEntryType(nextEntryType),
          resolvedDate: nextDate,
          personName: nextPersonName,
          category: nextCategory,
        }),
      },
    });

    const afterSnapshot = toEntrySnapshot(updatedEntry);

    await tx.entryCorrection.create({
      data: {
        entryId,
        actorUserId: userId,
        reason: changes.reason ?? "Manual correction",
        sourceText: existing.sourceText,
        beforeSnapshot: beforeSnapshot as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
      },
    });

    return {
      updated: true,
      entryId,
      message: "The entry was updated successfully.",
    };
  });
}

export async function undoLastCorrection(params: {
  userId: string;
  entryId: string;
}) {
  const { userId, entryId } = params;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existing) {
      throw new Error("The target entry could not be found.");
    }

    const lastCorrection = await tx.entryCorrection.findFirst({
      where: {
        entryId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastCorrection) {
      throw new Error("There is no correction available to undo for this entry.");
    }

    const beforeSnapshot = lastCorrection.beforeSnapshot as unknown as EntrySnapshot;
    const currentSnapshot = toEntrySnapshot(existing);

    await tx.ledgerEntry.update({
      where: {
        id: entryId,
      },
      data: applySnapshotToUpdate(beforeSnapshot),
    });

    await tx.entryCorrection.create({
      data: {
        entryId,
        actorUserId: userId,
        reason: "Undo last correction",
        sourceText: existing.sourceText,
        beforeSnapshot: currentSnapshot as Prisma.InputJsonValue,
        afterSnapshot: beforeSnapshot as Prisma.InputJsonValue,
      },
    });

    return {
      updated: true,
      entryId,
      message: "The last correction was undone.",
    };
  });
}
