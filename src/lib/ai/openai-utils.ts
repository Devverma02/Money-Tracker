import { serverEnv } from "@/lib/env/server";

/**
 * Extract structured text from an OpenAI Responses-API payload.
 * Works with both the `output_text` shortcut and the full
 * `output[].content[].text` shape.
 */
export function extractStructuredText(payload: unknown): string | null {
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

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

export async function createEmbeddings(input: string[]) {
  const items = input.map((item) => item.trim()).filter(Boolean);

  if (items.length === 0) {
    return [] as number[][];
  }

  if (!serverEnv.OPENAI_API_KEY || serverEnv.OPENAI_API_KEY.includes("replace-with")) {
    throw new Error("OpenAI embeddings are not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: items,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embeddings = payload.data?.map((item) => item.embedding ?? []) ?? [];

  if (embeddings.length !== items.length || embeddings.some((item) => item.length === 0)) {
    throw new Error("OpenAI embeddings returned an unexpected shape.");
  }

  return embeddings;
}
