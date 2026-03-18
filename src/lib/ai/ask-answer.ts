import {
  askAiJsonSchema,
  askAiRequestSchema,
  askAiResponseSchema,
  type AskAiConversationMessage,
  type AskAiReplyLanguage,
  type AskAiResponse,
} from "@/lib/ai/ask-contract";
import { getAskAiFacts, type AskAiFacts } from "@/lib/ai/ask-facts";
import { serverEnv } from "@/lib/env/server";
import { type VoiceReplyContext, voiceText } from "@/lib/voice/voice-localization";

const ASK_AI_MODEL = "gpt-4o-mini";

function buildEffectiveQuestion(
  question: string,
  conversation: AskAiConversationMessage[],
) {
  const normalized = question.trim();

  if (!normalized) {
    return question;
  }

  const looksStandalone =
    /\b(today|week|month|year|income|expense|spent|spend|loan|udhaar|cash|entry|entries|kitna|kitni|kitne|history|reminder|category|person|raju|salary|aamdani|kharcha|last|recent|latest)\b/i.test(
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

  if (/^(and|aur|or|usme|uska|what about|then|phir|iske|uske)\b/i.test(normalized)) {
    return `${lastUserMessage.text}\nFollow-up: ${normalized}`;
  }

  return normalized;
}

function getReplyContext(language: AskAiReplyLanguage): VoiceReplyContext {
  if (language === "hindi") {
    return {
      mode: "hindi",
      speechLang: "hi-IN",
    };
  }

  if (language === "english") {
    return {
      mode: "english",
      speechLang: "en-IN",
    };
  }

  return {
    mode: "hinglish",
    speechLang: "en-IN",
  };
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

function localizeAnswer(
  context: VoiceReplyContext,
  copy: {
    english: string;
    hinglish: string;
    hindi: string;
  },
) {
  return voiceText(context, copy);
}

function isBalanceQuestion(normalized: string) {
  return /\b(balance|kitna bacha|kitne bache|bache hue|account|wallet|pass kitna|kitna hai abhi)\b/i.test(
    normalized,
  );
}

function isPayReceiveQuestion(normalized: string) {
  return /\b(dena|dene|lena|lene|pay|receive|kisko dena|kis ko dena|kisse lena|kis se lena|kisi ko dena)\b/i.test(
    normalized,
  );
}

function shouldUseDeterministicFastPath(normalized: string) {
  return (
    /\b(last transaction|latest entry|recent entry|recent transaction|last entry)\b/.test(normalized) ||
    /\b(how many|kitni|kitne|count|entries)\b/.test(normalized) ||
    /udhaar|loan/.test(normalized) ||
    /kharcha|expense|spend/.test(normalized) ||
    /income|aamdani|kamaya/.test(normalized) ||
    isBalanceQuestion(normalized) ||
    isPayReceiveQuestion(normalized)
  );
}

function buildFallbackAnswer(
  facts: AskAiFacts,
  replyLanguage: AskAiReplyLanguage,
): AskAiResponse {
  const normalized = facts.question.toLowerCase();
  const context = getReplyContext(replyLanguage);
  const factualPoints = [
    `${facts.summary.label} cash in Rs ${facts.summary.cashInTotal}`,
    `${facts.summary.label} cash out Rs ${facts.summary.cashOutTotal}`,
    `${facts.summary.label} net cash movement Rs ${facts.summary.netCashMovement}`,
    `${facts.summary.label} total entries ${facts.summary.entryCount}`,
  ];

  if (/last transaction|latest entry|recent entry|recent transaction|last entry/.test(normalized)) {
    const latestEntry = facts.recentEntries[0];

    if (!latestEntry) {
      return {
        answerText: localizeAnswer(context, {
          english: "No recent saved entry is visible in the current records.",
          hinglish: "Abhi current records me koi recent saved entry nahi dikh rahi.",
          hindi: "अभी current records में कोई recent saved entry नहीं दिख रही है।",
        }),
        factualPoints,
        uncertaintyNote: null,
        parserMode: "deterministic",
        resolvedPeriod: facts.resolvedPeriod,
        resolvedPeriodLabel: facts.resolvedPeriodLabel,
      };
    }

    return {
      answerText: localizeAnswer(context, {
        english: `The latest saved item is ${latestEntry.entryType.toLowerCase().replaceAll("_", " ")} of Rs ${latestEntry.amount} on ${latestEntry.entryDate.slice(0, 10)}.`,
        hinglish: `Latest saved item Rs ${latestEntry.amount} ka ${latestEntry.entryType.toLowerCase().replaceAll("_", " ")} hai, date ${latestEntry.entryDate.slice(0, 10)}.`,
        hindi: `सबसे नई saved entry ${latestEntry.entryDate.slice(0, 10)} की Rs ${latestEntry.amount} वाली ${latestEntry.entryType.toLowerCase().replaceAll("_", " ")} है।`,
      }),
      factualPoints: [
        ...factualPoints,
        `Latest item Rs ${latestEntry.amount} | ${latestEntry.entryType.toLowerCase().replaceAll("_", " ")} | ${latestEntry.entryDate.slice(0, 10)}`,
      ].slice(0, 6),
      uncertaintyNote: latestEntry.note
        ? localizeAnswer(context, {
            english: `Saved note: ${latestEntry.note}`,
            hinglish: `Saved note: ${latestEntry.note}`,
            hindi: `Saved note: ${latestEntry.note}`,
          })
        : null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (/\b(how many|kitni|kitne|count|entries)\b/.test(normalized)) {
    return {
      answerText: localizeAnswer(context, {
        english: `${facts.summary.label} has ${facts.totalMatchingEntries} matching saved entries.`,
        hinglish: `${facts.summary.label} me ${facts.totalMatchingEntries} matching saved entries hain.`,
        hindi: `${facts.summary.label} में ${facts.totalMatchingEntries} matching saved entries हैं।`,
      }),
      factualPoints,
      uncertaintyNote: null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (/udhaar|loan/.test(normalized)) {
    if (facts.pendingLoans.length === 0) {
      return {
        answerText: localizeAnswer(context, {
          english: "No pending loans are visible in the current structured records.",
          hinglish: "Current structured records me abhi koi pending loan nahi dikh raha.",
          hindi: "मौजूदा structured records में अभी कोई pending loan नहीं दिख रहा है।",
        }),
        factualPoints,
        uncertaintyNote: null,
        parserMode: "deterministic",
        resolvedPeriod: facts.resolvedPeriod,
        resolvedPeriodLabel: facts.resolvedPeriodLabel,
      };
    }

    const topLoan = facts.pendingLoans[0];
    return {
      answerText:
        topLoan.receivable > 0
          ? localizeAnswer(context, {
              english: `You still need to receive Rs ${topLoan.receivable} from ${topLoan.personName}.`,
              hinglish: `${topLoan.personName} se abhi bhi Rs ${topLoan.receivable} lene hain.`,
              hindi: `${topLoan.personName} से अभी भी Rs ${topLoan.receivable} लेने हैं।`,
            })
          : localizeAnswer(context, {
              english: `You still need to pay Rs ${topLoan.payable} to ${topLoan.personName}.`,
              hinglish: `${topLoan.personName} ko abhi bhi Rs ${topLoan.payable} dene hain.`,
              hindi: `${topLoan.personName} को अभी भी Rs ${topLoan.payable} देने हैं।`,
            }),
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
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (isPayReceiveQuestion(normalized)) {
    const payablePeople = facts.pendingLoans.filter((item) => item.payable > 0);
    const receivablePeople = facts.pendingLoans.filter((item) => item.receivable > 0);

    if (payablePeople.length === 0 && receivablePeople.length === 0) {
      return {
        answerText: localizeAnswer(context, {
          english: "No clear pay or receive item is visible in the saved loan records right now.",
          hinglish: "Abhi saved loan records me koi clear dena ya lena item nahi dikh raha.",
          hindi: "अभी saved loan records में कोई साफ़ देना या लेना item नहीं दिख रहा है।",
        }),
        factualPoints,
        uncertaintyNote: null,
        parserMode: "deterministic",
        resolvedPeriod: facts.resolvedPeriod,
        resolvedPeriodLabel: facts.resolvedPeriodLabel,
      };
    }

    const payableText =
      payablePeople.length > 0
        ? payablePeople
            .slice(0, 3)
            .map((item) => `${item.personName} Rs ${item.payable}`)
            .join(", ")
        : null;
    const receivableText =
      receivablePeople.length > 0
        ? receivablePeople
            .slice(0, 3)
            .map((item) => `${item.personName} Rs ${item.receivable}`)
            .join(", ")
        : null;

    return {
      answerText: localizeAnswer(context, {
        english:
          payableText && receivableText
            ? `Right now you may need to pay ${payableText}, and you may still receive ${receivableText}.`
            : payableText
              ? `Right now you may need to pay ${payableText}.`
              : `Right now you may still receive ${receivableText}.`,
        hinglish:
          payableText && receivableText
            ? `Abhi aapko ${payableText} dena ho sakta hai, aur ${receivableText} lena baki ho sakta hai.`
            : payableText
              ? `Abhi aapko ${payableText} dena ho sakta hai.`
              : `Abhi aapko ${receivableText} lena baki ho sakta hai.`,
        hindi:
          payableText && receivableText
            ? `अभी आपको ${payableText} देना हो सकता है, और ${receivableText} लेना बाकी हो सकता है।`
            : payableText
              ? `अभी आपको ${payableText} देना हो सकता है।`
              : `अभी आपको ${receivableText} लेना बाकी हो सकता है।`,
      }),
      factualPoints: [
        ...factualPoints,
        ...facts.pendingLoans
          .slice(0, 4)
          .map(
            (item) =>
              `${item.personName}: receive Rs ${item.receivable}, pay Rs ${item.payable}`,
          ),
      ].slice(0, 6),
      uncertaintyNote: null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (isBalanceQuestion(normalized)) {
    return {
      answerText: localizeAnswer(context, {
        english: `Based on saved records, your current net available money looks around Rs ${facts.summary.netCashMovement}.`,
        hinglish: `Saved records ke hisaab se abhi aapke paas lagbhag Rs ${facts.summary.netCashMovement} net available dikh raha hai.`,
        hindi: `Saved records के हिसाब से अभी आपके पास लगभग Rs ${facts.summary.netCashMovement} net available दिख रहा है।`,
      }),
      factualPoints,
      uncertaintyNote: localizeAnswer(context, {
        english:
          "This is an estimate from saved records, not a direct bank balance.",
        hinglish:
          "Ye saved records ke hisaab se estimate hai, direct bank balance nahi.",
        hindi:
          "ये saved records के हिसाब से estimate है, direct bank balance नहीं।",
      }),
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (/kharcha|expense|spend/.test(normalized)) {
    return {
      answerText: facts.topSpendingCategory
        ? localizeAnswer(context, {
            english: `The most visible spending in ${facts.summary.label.toLowerCase()} is ${facts.topSpendingCategory.category} at Rs ${facts.topSpendingCategory.amount}.`,
            hinglish: `${facts.summary.label.toLowerCase()} me sabse zyada visible spending ${facts.topSpendingCategory.category} par Rs ${facts.topSpendingCategory.amount} ki hai.`,
            hindi: `${facts.summary.label.toLowerCase()} में सबसे ज़्यादा खर्च ${facts.topSpendingCategory.category} पर Rs ${facts.topSpendingCategory.amount} का है।`,
          })
        : localizeAnswer(context, {
            english: `Total cash out in ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.cashOutTotal}.`,
            hinglish: `${facts.summary.label.toLowerCase()} me total cash out Rs ${facts.summary.cashOutTotal} hai.`,
            hindi: `${facts.summary.label.toLowerCase()} में total cash out Rs ${facts.summary.cashOutTotal} है।`,
          }),
      factualPoints: facts.topSpendingCategory
        ? [
            ...factualPoints,
            `Top spending category ${facts.topSpendingCategory.category} Rs ${facts.topSpendingCategory.amount}`,
          ].slice(0, 6)
        : factualPoints,
      uncertaintyNote:
        facts.topSpendingCategory === null
          ? localizeAnswer(context, {
              english:
                "Category detail is limited because not many expense entries are categorized yet.",
              hinglish:
                "Category detail abhi limited hai, kyunki bahut si expense entries categorized nahi hain.",
              hindi:
                "Category detail अभी limited है, क्योंकि कई expense entries categorized नहीं हैं।",
            })
          : null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  if (/income|aamdani|kamaya/.test(normalized)) {
    return {
      answerText: localizeAnswer(context, {
        english: `Cash in recorded for ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.cashInTotal}.`,
        hinglish: `${facts.summary.label.toLowerCase()} ke liye recorded cash in Rs ${facts.summary.cashInTotal} hai.`,
        hindi: `${facts.summary.label.toLowerCase()} के लिए recorded cash in Rs ${facts.summary.cashInTotal} है।`,
      }),
      factualPoints,
      uncertaintyNote: null,
      parserMode: "deterministic",
      resolvedPeriod: facts.resolvedPeriod,
      resolvedPeriodLabel: facts.resolvedPeriodLabel,
    };
  }

  return {
    answerText: localizeAnswer(context, {
      english: `Net cash movement for ${facts.summary.label.toLowerCase()} is Rs ${facts.summary.netCashMovement}, with cash in of Rs ${facts.summary.cashInTotal} and cash out of Rs ${facts.summary.cashOutTotal}.`,
      hinglish: `${facts.summary.label.toLowerCase()} ke liye net cash movement Rs ${facts.summary.netCashMovement} hai, jisme cash in Rs ${facts.summary.cashInTotal} aur cash out Rs ${facts.summary.cashOutTotal} hai.`,
      hindi: `${facts.summary.label.toLowerCase()} के लिए net cash movement Rs ${facts.summary.netCashMovement} है, जिसमें cash in Rs ${facts.summary.cashInTotal} और cash out Rs ${facts.summary.cashOutTotal} है।`,
    }),
    factualPoints,
    uncertaintyNote:
      facts.summary.entryCount === 0
        ? localizeAnswer(context, {
            english: "No saved entries were found in this period.",
            hinglish: "Is period me koi saved entry nahi mili.",
            hindi: "इस period में कोई saved entry नहीं मिली।",
          })
        : null,
    parserMode: "deterministic",
    resolvedPeriod: facts.resolvedPeriod,
    resolvedPeriodLabel: facts.resolvedPeriodLabel,
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
      model: ASK_AI_MODEL,
      store: false,
      max_output_tokens: 180,
      input: [
        {
          role: "system",
          content:
            `You answer money questions for a trust-first money assistant. Use only provided structured facts. Never invent numbers, people, balances, or loan states. First understand the user's exact intent. If the question is about amount left, answer from net cash movement and clearly call it a saved-record estimate, not bank balance. If the question is about who to pay or receive from, use pending loan facts first. If the facts are insufficient, say that clearly instead of guessing. Keep the answer short, direct, and useful in 2 to 4 sentences max. ${buildLanguageInstruction(replyLanguage)}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            currentQuestion: originalQuestion,
            recentConversation: conversation,
            facts,
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
  const effectiveQuestion = buildEffectiveQuestion(
    request.question,
    request.conversation,
  );
  const facts = await getAskAiFacts({
    userId: params.userId,
    question: effectiveQuestion,
    timeZone: request.timezone,
  });
  const normalizedEffectiveQuestion = effectiveQuestion.toLowerCase();

  if (shouldUseDeterministicFastPath(normalizedEffectiveQuestion)) {
    return buildFallbackAnswer(facts, request.replyLanguage);
  }

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return buildFallbackAnswer(facts, request.replyLanguage);
  }

  try {
    return await askWithOpenAI(
      facts,
      request.conversation,
      request.question,
      request.replyLanguage,
    );
  } catch {
    return buildFallbackAnswer(facts, request.replyLanguage);
  }
}
