import { prisma } from "@/lib/prisma";
import { extractStructuredText } from "@/lib/ai/openai-utils";
import { buildAiRuntimeContext } from "@/lib/ai/runtime-context";
import {
  askAiInterpretationJsonSchema,
  askAiInterpretationSchema,
  type AskAiInterpretation,
} from "@/lib/ai/ask-interpret-contract";
import { serverEnv } from "@/lib/env/server";

async function loadAskAiCandidates(userId: string) {
  const [entryPeople, reminderPeople, entryCategories, aliasCategories] =
    await Promise.all([
      prisma.ledgerEntry.findMany({
        where: {
          userId,
          personName: {
            not: null,
          },
        },
        select: {
          personName: true,
        },
        distinct: ["personName"],
        take: 120,
      }),
      prisma.reminder.findMany({
        where: {
          userId,
          linkedPerson: {
            not: null,
          },
        },
        select: {
          linkedPerson: true,
        },
        distinct: ["linkedPerson"],
        take: 80,
      }),
      prisma.ledgerEntry.findMany({
        where: {
          userId,
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: ["category"],
        take: 120,
      }),
      prisma.categoryAlias.findMany({
        where: {
          userId,
        },
        select: {
          canonicalName: true,
        },
        distinct: ["canonicalName"],
        take: 120,
      }),
    ]);

  const people = Array.from(
    new Set(
      [
        ...entryPeople.map((row) => row.personName ?? ""),
        ...reminderPeople.map((row) => row.linkedPerson ?? ""),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const categories = Array.from(
    new Set(
      [...entryCategories.map((row) => row.category ?? ""), ...aliasCategories.map((row) => row.canonicalName)]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return {
    people: people.slice(0, 80),
    categories: categories.slice(0, 80),
  };
}

function buildInterpreterPrompt() {
  return [
    "You are an AI question interpreter for a trust-first money assistant.",
    "Your job is to understand the user's question before structured facts are fetched.",
    "Return only valid JSON matching the schema.",
    "Use the provided runtime context for relative time phrases like today, kal, this week, last month, and overall.",
    "If a person or category from the candidate lists clearly matches, return that exact candidate string.",
    "If no candidate clearly matches, return null for that field.",
    "For periodQuery, return a short canonical phrase that the app can use for deterministic date resolution.",
    "Examples for periodQuery: today, yesterday, this week, last week, this month, last 3 months, March 2026, overall.",
    "Do not invent people or categories not supported by the candidates unless the question is clearly generic; then return null.",
    "interpretedQuestion should be a short clean restatement of the user's question.",
    "focus should be the main intent: balance, loans, income, expense, history, reminder, person, category, or general.",
  ].join(" ");
}

export async function interpretAskAiQuestion(params: {
  userId: string;
  question: string;
  timezone: string;
  locale?: string;
}): Promise<AskAiInterpretation | null> {
  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return null;
  }

  const { people, categories } = await loadAskAiCandidates(params.userId);
  const runtimeContext = buildAiRuntimeContext({
    timezone: params.timezone,
    locale: params.locale ?? "hi-IN",
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      store: false,
      max_output_tokens: 220,
      input: [
        {
          role: "system",
          content: buildInterpreterPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify({
            question: params.question,
            runtimeContext,
            people,
            categories,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ask_ai_interpretation",
          strict: true,
          schema: askAiInterpretationJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ask interpreter failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new Error("OpenAI ask interpreter returned no structured text.");
  }

  return askAiInterpretationSchema.parse(JSON.parse(structuredText));
}
