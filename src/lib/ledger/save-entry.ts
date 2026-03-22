import { Prisma, SourceMode } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import type { ParsedAction } from "@/lib/ai/parse-contract";
import { createDuplicateFingerprintFromParsedAction } from "@/lib/ledger/duplicate-fingerprint";
import { generateEntryNoteFromParsedAction } from "@/lib/ledger/entry-note";
import { prisma } from "@/lib/prisma";
import { toLedgerEntryType } from "@/lib/ledger/entry-types";
import { resolveCategoryName } from "@/lib/categories/category-aliases";
import { resolvePersonNameForAction } from "@/lib/persons/person-resolution";

async function ensureBucketId(
  tx: Prisma.TransactionClient,
  userId: string,
  bucketSlug: string,
) {
  const existingBucket = await tx.bucket.findFirst({
    where: {
      userId,
      slug: bucketSlug,
    },
  });

  if (existingBucket) {
    return existingBucket.id;
  }

  const profile = await tx.appProfile.findUnique({
    where: {
      id: userId,
    },
    select: {
      defaultBucketId: true,
    },
  });

  return profile?.defaultBucketId ?? null;
}

function validateParsedAction(action: ParsedAction) {
  const ledgerEntryType = toLedgerEntryType(action.entryType);

  if (!ledgerEntryType) {
    throw new Error("The entry type is unclear. Please clarify it before saving.");
  }

  if (!action.resolvedDate) {
    throw new Error("The date is unclear. Please clarify it before saving.");
  }

  if (action.amount === null && ledgerEntryType !== "NOTE") {
    throw new Error("The amount is unclear. Please clarify it before saving.");
  }

  return {
    ledgerEntryType,
    resolvedEntryDate: action.resolvedDate,
    resolvedAmount: action.amount ?? 0,
  };
}

async function saveParsedActionWithTx(params: {
  tx: Prisma.TransactionClient;
  user: User;
  action: ParsedAction;
  parserConfidence: number;
  actionIndex: number;
}) {
  const { tx, user, action, parserConfidence, actionIndex } = params;
  const { ledgerEntryType, resolvedAmount, resolvedEntryDate } =
    validateParsedAction(action);
  const bucketId = await ensureBucketId(tx, user.id, action.bucket ?? "personal");
  const resolvedPersonName = await resolvePersonNameForAction({
    tx,
    userId: user.id,
    action,
    actionIndex,
  });
  const resolvedCategory = await resolveCategoryName(user.id, action.category, tx);
  const duplicateFingerprint = createDuplicateFingerprintFromParsedAction(user.id, action);
  const generatedNote = await generateEntryNoteFromParsedAction(action);

  const recentDuplicates = await tx.ledgerEntry.findMany({
    where: {
      userId: user.id,
      duplicateFingerprint,
    },
    select: {
      id: true,
    },
    take: 3,
    orderBy: {
      createdAt: "desc",
    },
  });

  const entry = await tx.ledgerEntry.create({
    data: {
      userId: user.id,
      bucketId,
      sourceMode: SourceMode.TEXT,
      sourceText: action.sourceText,
      amount: new Prisma.Decimal(resolvedAmount),
      entryType: ledgerEntryType,
      category: resolvedCategory,
      entryDate: new Date(resolvedEntryDate),
      personName: resolvedPersonName,
      note: generatedNote,
      parserConfidence: new Prisma.Decimal(parserConfidence),
      requiresConfirmation: false,
      duplicateFingerprint,
    },
    select: {
      id: true,
    },
  });

  return {
    entryId: entry.id,
    duplicateWarning:
      recentDuplicates.length > 0
        ? {
            fingerprint: duplicateFingerprint,
            existingCount: recentDuplicates.length,
          }
        : null,
  };
}

function buildSaveMessage(savedCount: number, duplicateWarningCount: number) {
  if (savedCount === 1 && duplicateWarningCount === 0) {
    return "The entry was saved successfully.";
  }

  if (savedCount === 1) {
    return "The entry was saved, but a similar recent entry already exists.";
  }

  if (duplicateWarningCount === 0) {
    return `${savedCount} entries were saved successfully.`;
  }

  return `${savedCount} entries were saved. ${duplicateWarningCount} of them look similar to recent records.`;
}

export async function saveParsedEntries(params: {
  user: User;
  actions: ParsedAction[];
  parserConfidence: number;
}) {
  const { user, actions, parserConfidence } = params;

  if (actions.length === 0) {
    throw new Error("At least one reviewed entry is required before saving.");
  }

  const savedEntries = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const action of actions) {
      const result = await saveParsedActionWithTx({
        tx,
        user,
        action,
        parserConfidence,
        actionIndex: results.length,
      });
      results.push(result);
    }

    return results;
  });

  const duplicateWarningCount = savedEntries.filter(
    (entry) => entry.duplicateWarning !== null,
  ).length;

  return {
    saved: true as const,
    savedCount: savedEntries.length,
    duplicateWarningCount,
    savedEntries,
    message: buildSaveMessage(savedEntries.length, duplicateWarningCount),
  };
}
