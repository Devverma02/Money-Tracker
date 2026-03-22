import {
  askAiJsonSchema,
  askAiRequestSchema,
  askAiResponseSchema,
  type AskAiConversationMessage,
  type AskAiReplyLanguage,
  type AskAiResponse,
} from "@/lib/ai/ask-contract";
import { getAskAiFacts, type AskAiFacts } from "@/lib/ai/ask-facts";
import { extractStructuredText } from "@/lib/ai/openai-utils";
import { serverEnv } from "@/lib/env/server";

function buildEffectiveQuestion(
  question: string,
  conversation: AskAiConversationMessage[],
) {
  const normalized = question.trim();

  if (!normalized) {
    return question;
  }

  const looksStandalone =
    /\b(today|week|month|year|income|expense|spent|spend|loan|udhaar|cash|entry|entries|kitna|kitni|kitne|history|reminder|category|person|salary|aamdani|kharcha|last|recent|latest|balance|paisa|paise|rupaye)\b/i.test(
      normalized,
    );

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
    "1. Use ONLY the provided structured facts to answer. NEVER invent numbers, people, balances, or loan states.",
    "2. If the facts are insufficient to answer clearly, say so honestly instead of guessing.",
    "3. Keep answers short, direct, and useful — 2 to 4 sentences max.",
    "4. When answering about balance/kitna bacha, use net cash movement from facts and clearly say it is based on saved records, not bank balance.",
    "5. When answering about loans/udhaar, use the pendingLoans array and mention specific people and amounts.",
    "6. When answering about expenses/kharcha, break down by category if category data is available in topSpendingCategory or recentEntries.",
    "7. When answering about income/aamdani, use cashInTotal from the summary.",
    "8. Understand follow-up questions — use the conversation history to maintain context.",
    "9. If the user asks about a specific person, filter your answer to that person's data from the facts.",
    "10. If the user asks about last transaction/latest entry, use the recentEntries array.",
    "11. If asked to compare periods, use the data available and be honest about what you can see.",
    "",
    "ANSWER FORMAT:",
    "- answerText: The main natural language answer.",
    "- factualPoints: Up to 6 key data points used in your answer (for transparency).",
    "- uncertaintyNote: If the answer is an estimate or data is limited, note it. Otherwise null.",
    "",
    `LANGUAGE: ${buildLanguageInstruction(language)}`,
  ].join("\n");
}


async function askWithOpenAI(
  facts: AskAiFacts,
  conversation: AskAiConversationMessage[],
  originalQuestion: string,
  replyLanguage: AskAiReplyLanguage,
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
            recentConversation: conversation,
            facts: {
              question: facts.question,
              resolvedPeriod: facts.resolvedPeriod,
              resolvedPeriodLabel: facts.resolvedPeriodLabel,
              appliedPersonFilter: facts.appliedPersonFilter,
              appliedCategoryFilter: facts.appliedCategoryFilter,
              summary: facts.summary,
              pendingLoans: facts.pendingLoans,
              topSpendingCategory: facts.topSpendingCategory,
              recentEntries: facts.recentEntries,
              totalMatchingEntries: facts.totalMatchingEntries,
            },
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
    resolvedPeriod: facts.resolvedPeriod,
    resolvedPeriodLabel: facts.resolvedPeriodLabel,
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
      "AI service is not configured. Please set a valid OpenAI API key to use this feature."
    );
  }

  const effectiveQuestion = buildEffectiveQuestion(
    request.question,
    request.conversation,
  );

  const facts = await getAskAiFacts({
    userId: params.userId,
    question: effectiveQuestion,
    timeZone: request.timezone,
  });

  return await askWithOpenAI(
    facts,
    request.conversation,
    request.question,
    request.replyLanguage,
  );
}
