import { parseMoneyInputHeuristically } from "@/lib/ai/heuristic-parse";
import {
  parseRequestSchema,
  parseResultSchema,
  parserJsonSchema,
  type ParseRequest,
  type ParseResult,
} from "@/lib/ai/parse-contract";
import { serverEnv } from "@/lib/env/server";

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

async function parseWithOpenAI(request: ParseRequest): Promise<ParseResult> {
  const systemPrompt = [
    "You are a parser for a trust-first Hindi/Hinglish money assistant.",
    "Return only schema-valid JSON.",
    "Split multi-entry input into separate actions when the user mentions more than one money update.",
    "Never invent amounts, dates, or people.",
    "If any key money fact is unclear, set needsClarification=true and ask one short Hinglish clarification question.",
    "Default unresolved bucket to the first allowed bucket.",
    "This parser only suggests actions. It does not save data.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    raw_text: request.inputText,
    locale: request.locale,
    timezone: request.timezone,
    allowed_buckets: request.allowedBuckets,
    today: new Intl.DateTimeFormat("en-CA", {
      timeZone: request.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  });

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
          content: userPrompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "money_parse_result",
          strict: true,
          schema: parserJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI parse failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new Error("OpenAI parse returned no structured text.");
  }

  const parsed = JSON.parse(structuredText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI parse returned an invalid object payload.");
  }

  return parseResultSchema.parse({
    ...parsed,
    parserMode: "openai",
  });
}

export async function parseMoneyInput(input: unknown) {
  const request = parseRequestSchema.parse(input);

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return parseMoneyInputHeuristically(request);
  }

  try {
    return await parseWithOpenAI(request);
  } catch {
    return parseMoneyInputHeuristically(request);
  }
}
