import {
  askAiJsonSchema,
  askAiRequestSchema,
  askAiResponseSchema,
  type AskAiConversationMessage,
  type AskAiReplyLanguage,
  type AskAiResponse,
} from "@/lib/ai/ask-contract";
import type { AskAiInterpretation } from "@/lib/ai/ask-interpret-contract";
import { getAskAiFacts, type AskAiFacts } from "@/lib/ai/ask-facts";
import { interpretAskAiQuestion } from "@/lib/ai/ask-interpreter";
import {
  getAskAiHybridMatches,
  syncAskAiDocuments,
  type AskAiRetrievedMatch,
} from "@/lib/ai/ask-retrieval";
import { extractStructuredText } from "@/lib/ai/openai-utils";
import { buildAiRuntimeContext } from "@/lib/ai/runtime-context";
import { serverEnv } from "@/lib/env/server";
import { containsAnyNormalizedTerm } from "@/lib/text/unicode-search";

function buildEffectiveQuestion(
  question: string,
  conversation: AskAiConversationMessage[],
) {
  const normalized = question.trim();

  if (!normalized) {
    return question;
  }

  const looksStandalone =
    containsAnyNormalizedTerm(normalized, [
      "today",
      "week",
      "month",
      "year",
      "income",
      "expense",
      "spent",
      "spend",
      "loan",
      "udhaar",
      "cash",
      "entry",
      "entries",
      "kitna",
      "kitni",
      "kitne",
      "history",
      "reminder",
      "category",
      "person",
      "salary",
      "aamdani",
      "kharcha",
      "last",
      "recent",
      "latest",
      "balance",
      "paisa",
      "paise",
      "rupaye",
      "आज",
      "हफ्ता",
      "हफ्ते",
      "महीना",
      "महीने",
      "साल",
      "आय",
      "खर्च",
      "उधार",
      "पैसा",
      "पैसे",
      "रुपये",
      "कितना",
      "कितनी",
      "कितने",
      "इतिहास",
      "रिमाइंडर",
      "व्यक्ति",
      "श्रेणी",
      "बैलेंस",
    ]);

  if (looksStandalone) {
    return normalized;
  }

  const lastUserMessage = [...conversation]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return normalized;
  }

  if (/^(and|aur|or|usme|uska|what about|then|phir|iske|uske|aur\s)/i.test(normalized)) {
    return `${lastUserMessage.text}\nFollow-up: ${normalized}`;
  }

  return normalized;
}

function buildLanguageInstruction(language: AskAiReplyLanguage) {
  if (language === "hindi") {
    return "Reply in simple Hindi using Devanagari script.";
  }

  if (language === "english") {
    return "Reply in simple English.";
  }

  return "Reply in simple Hinglish using Roman script. Keep it natural and conversational.";
}

function buildAskSystemPrompt(language: AskAiReplyLanguage): string {
  return [
    "You are a smart, friendly money assistant for a trust-first personal finance app.",
    "You answer questions about the user's saved money records.",
    "",
    "RULES:",
    "1. Use ONLY the provided data packs to answer. Never invent numbers, people, balances, reminders, or loan states.",
    "2. Structured facts are the source of truth for exact totals, counts, balances, pending amounts, and period summaries.",
    "3. Semantic matches are supporting memory snippets from saved entries and reminders. Use them for context and recall, but never let them override structured facts.",
    "4. If the available data is insufficient to answer clearly, say so honestly instead of guessing.",
    "5. Keep answers short, direct, and useful - 2 to 4 sentences max.",
    "6. When answering about current balance or kitna bacha, use trackedBalance from facts and clearly say it is based on the user's saved starting balance plus saved cash movements.",
    "7. When answering about loans or udhaar, use pendingLoans and mention specific people and amounts.",
    "8. When answering about expenses or kharcha, use categories and recent entries when helpful.",
    "9. When answering about income or aamdani, use cashInTotal from the summary.",
    "10. Understand follow-up questions and use the recent conversation context.",
    "11. If the user asks about a specific person or category, focus on that filter from the facts.",
    "12. If the user asks about latest or recent activity, use recentEntries first and semantic matches second.",
    "13. Use the runtime context for interpreting relative time expressions like today, kal, this week, and this month.",
    "",
    "ANSWER FORMAT:",
    "- answerText: the main natural-language answer.",
    "- factualPoints: up to 6 short bullet-like data points used in the answer.",
    "- uncertaintyNote: mention limits only when needed, otherwise null.",
    "",
    `LANGUAGE: ${buildLanguageInstruction(language)}`,
  ].join("\n");
}

function buildSemanticMatchesPayload(matches: AskAiRetrievedMatch[]) {
  return matches.slice(0, 5).map((match) => ({
    sourceType: match.sourceType,
    sourceId: match.sourceId,
    finalScore: Number(match.finalScore.toFixed(3)),
    textRank: Number(match.textRank.toFixed(3)),
    vectorRank: Number(match.vectorRank.toFixed(3)),
    content: match.content,
    metadata: match.metadata,
  }));
}

async function askWithOpenAI(
  facts: AskAiFacts,
  semanticMatches: AskAiRetrievedMatch[],
  conversation: AskAiConversationMessage[],
  originalQuestion: string,
  replyLanguage: AskAiReplyLanguage,
  runtimeContext: ReturnType<typeof buildAiRuntimeContext>,
  interpretation: AskAiInterpretation | null,
): Promise<AskAiResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      store: false,
      max_output_tokens: 300,
      input: [
        {
          role: "system",
          content: buildAskSystemPrompt(replyLanguage),
        },
        {
          role: "user",
          content: JSON.stringify({
            currentQuestion: originalQuestion,
            runtimeContext,
            interpretation,
            recentConversation: conversation,
            facts: {
              question: facts.question,
              resolvedPeriod: facts.resolvedPeriod,
              resolvedPeriodLabel: facts.resolvedPeriodLabel,
              appliedPersonFilter: facts.appliedPersonFilter,
              appliedCategoryFilter: facts.appliedCategoryFilter,
              trackedBalance: facts.trackedBalance,
              summary: facts.summary,
              pendingLoans: facts.pendingLoans,
              topSpendingCategory: facts.topSpendingCategory,
              recentEntries: facts.recentEntries,
              totalMatchingEntries: facts.totalMatchingEntries,
            },
            semanticMatches: buildSemanticMatchesPayload(semanticMatches),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ask_ai_response",
          strict: true,
          schema: askAiJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ask failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new Error("OpenAI ask returned no structured text.");
  }

  const parsed = JSON.parse(structuredText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI ask returned invalid object.");
  }

  return askAiResponseSchema.parse({
    ...parsed,
    parserMode: "openai",
    retrievalMode: semanticMatches.length > 0 ? "hybrid" : "facts-only",
    retrievalMatchCount: semanticMatches.length,
    resolvedPeriod: facts.resolvedPeriod,
    resolvedPeriodLabel: facts.resolvedPeriodLabel,
    interpretation: interpretation
      ? {
          personFilter: interpretation.personFilter,
          categoryFilter: interpretation.categoryFilter,
          periodQuery: interpretation.periodQuery,
          focus: interpretation.focus,
          confidence: interpretation.confidence,
        }
      : null,
  });
}

export async function answerAskAiQuestion(params: {
  userId: string;
  question: string;
  timeZone: string;
  replyLanguage?: AskAiReplyLanguage;
  conversation?: AskAiConversationMessage[];
}) {
  const request = askAiRequestSchema.parse({
    question: params.question,
    timezone: params.timeZone,
    replyLanguage: params.replyLanguage,
    conversation: params.conversation ?? [],
  });

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    throw new Error(
      "AI service is not configured. Please set a valid OpenAI API key to use this feature.",
    );
  }

  const effectiveQuestion = buildEffectiveQuestion(
    request.question,
    request.conversation,
  );
  const runtimeContext = buildAiRuntimeContext({
    timezone: request.timezone,
    locale: "hi-IN",
  });
  let interpretation: AskAiInterpretation | null = null;

  try {
    interpretation = await interpretAskAiQuestion({
      userId: params.userId,
      question: effectiveQuestion,
      timezone: request.timezone,
      locale: runtimeContext.locale,
    });
  } catch (error) {
    console.error("Ask AI interpreter skipped:", error);
  }

  const facts = await getAskAiFacts({
    userId: params.userId,
    question: interpretation?.interpretedQuestion?.trim() || effectiveQuestion,
    timeZone: request.timezone,
    interpretation,
  });

  let semanticMatches: AskAiRetrievedMatch[] = [];

  try {
    await syncAskAiDocuments(params.userId);
    semanticMatches = await getAskAiHybridMatches({
      userId: params.userId,
      question: effectiveQuestion,
    });
  } catch (error) {
    console.error("Ask AI hybrid retrieval skipped:", error);
  }

  return askWithOpenAI(
    facts,
    semanticMatches,
    request.conversation,
    request.question,
    request.replyLanguage,
    runtimeContext,
    interpretation,
  );
}
