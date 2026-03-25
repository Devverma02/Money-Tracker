import { createHash } from "node:crypto";
import { Prisma, ReminderStatus } from "@prisma/client";
import { createEmbeddings } from "@/lib/ai/openai-utils";
import { prisma } from "@/lib/prisma";

const ASK_AI_INDEX_VERSION = 1;
const ASK_AI_MATCH_COUNT = 6;

type AskAiDocumentSourceType = "ledger_entry" | "reminder";

type AskAiDocumentMetadata = {
  version: number;
  sourceUpdatedAt: string;
  contentHash: string;
  entryType?: string;
  category?: string | null;
  personName?: string | null;
  reminderStatus?: string;
};

type AskAiSourceDocument = {
  sourceType: AskAiDocumentSourceType;
  sourceId: string;
  content: string;
  metadata: AskAiDocumentMetadata;
};

type ExistingAskAiDocument = {
  source_type: AskAiDocumentSourceType;
  source_id: string;
  metadata: AskAiDocumentMetadata | null;
};

export type AskAiRetrievedMatch = {
  sourceType: AskAiDocumentSourceType;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  textRank: number;
  vectorRank: number;
  finalScore: number;
};

function serializeEmbedding(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function hashContent(content: string) {
  return createHash("sha1").update(content).digest("hex");
}

function buildLedgerEntryDocument(entry: {
  id: string;
  amount: Prisma.Decimal;
  entryType: string;
  category: string | null;
  personName: string | null;
  note: string | null;
  sourceText: string | null;
  entryDate: Date;
  updatedAt: Date;
}) {
  const amount = entry.amount.toNumber();
  const parts = [
    `Ledger entry on ${entry.entryDate.toISOString().slice(0, 10)}.`,
    `Type: ${entry.entryType.replaceAll("_", " ").toLowerCase()}.`,
    `Amount: ${amount}.`,
  ];

  if (entry.personName) {
    parts.push(`Person: ${entry.personName}.`);
  }

  if (entry.category) {
    parts.push(`Category: ${entry.category}.`);
  }

  if (entry.note) {
    parts.push(`Note: ${entry.note}.`);
  }

  if (entry.sourceText) {
    parts.push(`Original input: ${entry.sourceText}.`);
  }

  const content = parts.join(" ");

  return {
    sourceType: "ledger_entry" as const,
    sourceId: entry.id,
    content,
    metadata: {
      version: ASK_AI_INDEX_VERSION,
      sourceUpdatedAt: entry.updatedAt.toISOString(),
      contentHash: hashContent(content),
      entryType: entry.entryType,
      category: entry.category,
      personName: entry.personName,
    },
  } satisfies AskAiSourceDocument;
}

function buildReminderDocument(reminder: {
  id: string;
  title: string;
  linkedPerson: string | null;
  dueAt: Date;
  status: ReminderStatus;
  updatedAt: Date;
}) {
  const parts = [
    `Reminder due on ${reminder.dueAt.toISOString()}.`,
    `Title: ${reminder.title}.`,
    `Status: ${reminder.status.toLowerCase()}.`,
  ];

  if (reminder.linkedPerson) {
    parts.push(`Linked person: ${reminder.linkedPerson}.`);
  }

  const content = parts.join(" ");

  return {
    sourceType: "reminder" as const,
    sourceId: reminder.id,
    content,
    metadata: {
      version: ASK_AI_INDEX_VERSION,
      sourceUpdatedAt: reminder.updatedAt.toISOString(),
      contentHash: hashContent(content),
      personName: reminder.linkedPerson,
      reminderStatus: reminder.status,
    },
  } satisfies AskAiSourceDocument;
}

async function loadSourceDocuments(userId: string) {
  const [entries, reminders] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        amount: true,
        entryType: true,
        category: true,
        personName: true,
        note: true,
        sourceText: true,
        entryDate: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.reminder.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        title: true,
        linkedPerson: true,
        dueAt: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  return [
    ...entries.map(buildLedgerEntryDocument),
    ...reminders.map(buildReminderDocument),
  ] satisfies AskAiSourceDocument[];
}

async function loadExistingDocuments(userId: string) {
  return prisma.$queryRaw<ExistingAskAiDocument[]>(Prisma.sql`
    select source_type, source_id, metadata
    from public.ask_ai_documents
    where user_id = ${userId}::uuid
  `);
}

function buildDocumentKey(document: {
  sourceType: AskAiDocumentSourceType;
  sourceId: string;
}) {
  return `${document.sourceType}:${document.sourceId}`;
}

function metadataNeedsRefresh(
  existing: AskAiDocumentMetadata | null | undefined,
  next: AskAiDocumentMetadata,
) {
  if (!existing) {
    return true;
  }

  return (
    existing.version !== next.version ||
    existing.sourceUpdatedAt !== next.sourceUpdatedAt ||
    existing.contentHash !== next.contentHash
  );
}

async function upsertAskAiDocument(params: {
  userId: string;
  document: AskAiSourceDocument;
  embedding: number[];
}) {
  const embeddingLiteral = serializeEmbedding(params.embedding);

  await prisma.$executeRaw(
    Prisma.sql`
      insert into public.ask_ai_documents (
        user_id,
        source_type,
        source_id,
        content,
        metadata,
        embedding,
        created_at,
        updated_at
      )
      values (
        ${params.userId}::uuid,
        ${params.document.sourceType},
        ${params.document.sourceId},
        ${params.document.content},
        ${JSON.stringify(params.document.metadata)}::jsonb,
        ${embeddingLiteral}::vector,
        now(),
        now()
      )
      on conflict (user_id, source_type, source_id)
      do update set
        content = excluded.content,
        metadata = excluded.metadata,
        embedding = excluded.embedding,
        updated_at = now()
    `,
  );
}

async function deleteStaleDocuments(params: {
  userId: string;
  staleDocuments: ExistingAskAiDocument[];
}) {
  for (const document of params.staleDocuments) {
    await prisma.$executeRaw(
      Prisma.sql`
        delete from public.ask_ai_documents
        where user_id = ${params.userId}::uuid
          and source_type = ${document.source_type}
          and source_id = ${document.source_id}
      `,
    );
  }
}

export async function syncAskAiDocuments(userId: string) {
  const [sourceDocuments, existingDocuments] = await Promise.all([
    loadSourceDocuments(userId),
    loadExistingDocuments(userId),
  ]);

  const existingByKey = new Map(
    existingDocuments.map((document) => [buildDocumentKey({
      sourceType: document.source_type,
      sourceId: document.source_id,
    }), document]),
  );
  const sourceKeys = new Set(sourceDocuments.map(buildDocumentKey));

  const changedDocuments = sourceDocuments.filter((document) =>
    metadataNeedsRefresh(
      existingByKey.get(buildDocumentKey(document))?.metadata,
      document.metadata,
    ),
  );

  if (changedDocuments.length > 0) {
    const embeddings = await createEmbeddings(
      changedDocuments.map((document) => document.content),
    );

    for (const [index, document] of changedDocuments.entries()) {
      await upsertAskAiDocument({
        userId,
        document,
        embedding: embeddings[index],
      });
    }
  }

  const staleDocuments = existingDocuments.filter(
    (document) =>
      !sourceKeys.has(
        buildDocumentKey({
          sourceType: document.source_type,
          sourceId: document.source_id,
        }),
      ),
  );

  if (staleDocuments.length > 0) {
    await deleteStaleDocuments({
      userId,
      staleDocuments,
    });
  }
}

export async function getAskAiHybridMatches(params: {
  userId: string;
  question: string;
  matchCount?: number;
}) {
  const queryText = params.question.trim();

  if (!queryText) {
    return [] as AskAiRetrievedMatch[];
  }

  const [queryEmbedding] = await createEmbeddings([queryText]);
  const embeddingLiteral = serializeEmbedding(queryEmbedding);
  const matchCount = params.matchCount ?? ASK_AI_MATCH_COUNT;

  const rows = await prisma.$queryRaw<
    Array<{
      source_type: AskAiDocumentSourceType;
      source_id: string;
      content: string;
      metadata: Record<string, unknown> | null;
      text_rank: number | null;
      vector_rank: number | null;
      final_score: number | null;
    }>
  >(Prisma.sql`
    select
      source_type,
      source_id,
      content,
      metadata,
      text_rank,
      vector_rank,
      final_score
    from public.hybrid_search_ask_ai_documents(
      ${queryText},
      ${embeddingLiteral}::vector,
      ${params.userId}::uuid,
      ${matchCount}::int
    )
  `);

  return rows.map((row) => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    content: row.content,
    metadata: row.metadata ?? {},
    textRank: row.text_rank ?? 0,
    vectorRank: row.vector_rank ?? 0,
    finalScore: row.final_score ?? 0,
  }));
}
