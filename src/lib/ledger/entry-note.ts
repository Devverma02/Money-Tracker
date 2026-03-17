import type { EntryType } from "@prisma/client";
import { serverEnv } from "@/lib/env/server";
import type { ParsedAction } from "@/lib/ai/parse-contract";

type EntryNoteInput = {
  entryType: string;
  amount: number;
  entryDate: string;
  personName?: string | null;
  category?: string | null;
  sourceText?: string | null;
};

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

function normalizeEntryTypeLabel(entryType: string) {
  const map: Record<string, string> = {
    expense: "kharcha",
    income: "income",
    loan_given: "diya hua loan",
    loan_taken: "liya hua loan",
    loan_received_back: "wapas mila loan",
    loan_repaid: "loan repayment",
    savings_deposit: "savings deposit",
    note: "note",
    EXPENSE: "kharcha",
    INCOME: "income",
    LOAN_GIVEN: "diya hua loan",
    LOAN_TAKEN: "liya hua loan",
    LOAN_RECEIVED_BACK: "wapas mila loan",
    LOAN_REPAID: "loan repayment",
    SAVINGS_DEPOSIT: "savings deposit",
    NOTE: "note",
    REMINDER: "reminder",
  };

  return map[entryType] ?? entryType.replaceAll("_", " ").toLowerCase();
}

export function buildDeterministicEntryNote(input: EntryNoteInput) {
  const typeLabel = normalizeEntryTypeLabel(input.entryType);
  const amountLabel = formatCurrency(input.amount);
  const personLabel = input.personName ? ` ${input.personName} ke saath` : "";
  const categoryLabel = input.category ? ` Category ${input.category} thi.` : "";
  const dateLabel = input.entryDate ? ` Date ${input.entryDate} rakhi gayi.` : "";

  if (typeLabel === "kharcha") {
    return `${amountLabel} ka kharcha${personLabel} add hua.${categoryLabel}${dateLabel}`.trim();
  }

  if (typeLabel === "income") {
    return `${amountLabel} ki income${personLabel} add hui.${categoryLabel}${dateLabel}`.trim();
  }

  if (typeLabel === "diya hua loan") {
    return `${amountLabel} ka loan${personLabel} diya gaya.${dateLabel}`.trim();
  }

  if (typeLabel === "liya hua loan") {
    return `${amountLabel} ka loan${personLabel} liya gaya.${dateLabel}`.trim();
  }

  if (typeLabel === "wapas mila loan") {
    return `${amountLabel}${personLabel} se wapas mila.${dateLabel}`.trim();
  }

  if (typeLabel === "loan repayment") {
    return `${amountLabel}${personLabel} ko repay kiya gaya.${dateLabel}`.trim();
  }

  if (typeLabel === "savings deposit") {
    return `${amountLabel} savings me jama kiye gaye.${dateLabel}`.trim();
  }

  if (input.sourceText) {
    return `${typeLabel} entry save hui. Original baat: ${input.sourceText}`;
  }

  return `${amountLabel} ki ${typeLabel} entry save hui.${dateLabel}`.trim();
}

async function generateEntryNoteWithOpenAI(input: EntryNoteInput) {
  const systemPrompt = [
    "You write saved ledger notes for a trust-first money assistant.",
    "Write in plain Hinglish only.",
    "Use 1 or 2 short sentences.",
    "Be factual and specific.",
    "Mention amount, person, category, and date only if present.",
    "Do not add advice.",
    "Do not invent missing facts.",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: serverEnv.OPENAI_MODEL,
      store: false,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      max_output_tokens: 120,
    }),
  });

  if (!response.ok) {
    throw new Error("OpenAI note generation failed.");
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };

  const text = payload.output_text?.trim();

  if (!text) {
    throw new Error("OpenAI note generation returned empty text.");
  }

  return text;
}

export async function generateEntryNote(input: EntryNoteInput) {
  const fallbackNote = buildDeterministicEntryNote(input);

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return fallbackNote;
  }

  try {
    return await generateEntryNoteWithOpenAI(input);
  } catch {
    return fallbackNote;
  }
}

export async function generateEntryNoteFromParsedAction(action: ParsedAction) {
  return generateEntryNote({
    entryType: action.entryType ?? "note",
    amount: action.amount ?? 0,
    entryDate: action.resolvedDate ?? "",
    personName: action.personName,
    category: action.category,
    sourceText: action.sourceText ?? action.note,
  });
}

export async function generateEntryNoteFromLedgerEntry(input: {
  entryType: EntryType;
  amount: number;
  entryDate: string;
  personName?: string | null;
  category?: string | null;
  sourceText?: string | null;
}) {
  return generateEntryNote({
    entryType: input.entryType,
    amount: input.amount,
    entryDate: input.entryDate,
    personName: input.personName,
    category: input.category,
    sourceText: input.sourceText,
  });
}
