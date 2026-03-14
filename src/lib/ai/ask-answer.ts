import {
  askAiJsonSchema,
  askAiRequestSchema,
  askAiResponseSchema,
  type AskAiResponse,
} from "@/lib/ai/ask-contract";
import { getAskAiFacts, type AskAiFacts } from "@/lib/ai/ask-facts";
import { serverEnv } from "@/lib/env/server";

function buildFallbackAnswer(facts: AskAiFacts): AskAiResponse {
  const normalized = facts.question.toLowerCase();
  const factualPoints = [
    `${facts.summary.label} cash in Rs ${facts.summary.cashInTotal}`,
    `${facts.summary.label} cash out Rs ${facts.summary.cashOutTotal}`,
    `${facts.summary.label} net cash movement Rs ${facts.summary.netCashMovement}`,
    `${facts.summary.label} total entries ${facts.summary.entryCount}`,
  ];

  if (/udhaar|loan/.test(normalized)) {
    if (facts.pendingLoans.length === 0) {
      return {
        answerText: "No pending loans are visible in the current structured records.",
        factualPoints,
        uncertaintyNote: null,
        parserMode: "deterministic",
        resolvedPeriod: facts.resolvedPeriod,
      };
    }

    const topLoan = facts.pendingLoans[0];
    return {
      answerText:
        topLoan.receivable > 0
          ? `You still need to receive Rs ${topLoan.receivable} from ${topLoan.personName}.`
          : `You still need to pay Rs ${topLoan.payable} to ${topLoan.personName}.`,
      factualPoints: [
        ...factualPoints,
        ...facts.pendingLoans.map(
          (item) =>
            `${item.personName}: receive Rs ${item.receivable}, pay Rs ${item.payable}`,
        ),
      ].slice(0, 6),
      uncertaintyNote: null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
    };
  }

  if (/kharcha|expense|spend/.test(normalized)) {
    return {
      answerText: facts.topSpendingCategory
        ? `The most visible spending in ${facts.summary.label.toLowerCase()} is ${facts.topSpendingCategory.category} at Rs ${facts.topSpendingCategory.amount}.`
        : `Total cash out in ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.cashOutTotal}.`,
      factualPoints: facts.topSpendingCategory
        ? [
            ...factualPoints,
            `Top spending category ${facts.topSpendingCategory.category} Rs ${facts.topSpendingCategory.amount}`,
          ].slice(0, 6)
        : factualPoints,
      uncertaintyNote:
        facts.topSpendingCategory === null
          ? "Category detail is limited because not many expense entries are categorized yet."
          : null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
    };
  }

  if (/income|aamdani|kamaya/.test(normalized)) {
    return {
      answerText: `Cash in recorded for ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.cashInTotal}.`,
      factualPoints,
      uncertaintyNote: null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
    };
  }

  return {
    answerText: `Net cash movement for ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.netCashMovement}, with cash in of Rs ${facts.summary.cashInTotal} and cash out of Rs ${facts.summary.cashOutTotal}.`,
    factualPoints,
    uncertaintyNote:
      facts.summary.entryCount === 0
        ? "No saved entries were found in this period."
        : null,
    parserMode: "deterministic",
    resolvedPeriod: facts.resolvedPeriod,
  };
}

function extractStructuredText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      if (
        item &&
        typeof item === "object" &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        for (const contentItem of item.content) {
          if (
            contentItem &&
            typeof contentItem === "object" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return contentItem.text;
          }
        }
      }
    }
  }

  return null;
}

async function askWithOpenAI(facts: AskAiFacts): Promise<AskAiResponse> {
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
          content:
            "You answer money questions for a trust-first Hindi Hinglish assistant. Use only provided structured facts. Do not invent numbers. Keep the answer simple and non-judgmental.",
        },
        {
          role: "user",
          content: JSON.stringify(facts),
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
  });
}

export async function answerAskAiQuestion(params: {
  userId: string;
  question: string;
  timeZone: string;
}) {
  const request = askAiRequestSchema.parse({
    question: params.question,
    timezone: params.timeZone,
  });
  const facts = await getAskAiFacts({
    userId: params.userId,
    question: request.question,
    timeZone: request.timezone,
  });

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return buildFallbackAnswer(facts);
  }

  try {
    return await askWithOpenAI(facts);
  } catch {
    return buildFallbackAnswer(facts);
  }
}
