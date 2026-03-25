import { z } from "zod";
import { askAiFocusSchema } from "@/lib/ai/ask-interpret-contract";

export const askAiReplyLanguageSchema = z.enum(["english", "hinglish", "hindi"]);

export const askAiConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(500),
});

export const askAiRequestSchema = z.object({
  question: z.string().trim().min(3).max(300),
  timezone: z.string().default("Asia/Kolkata"),
  replyLanguage: askAiReplyLanguageSchema.default("hinglish"),
  conversation: z.array(askAiConversationMessageSchema).max(12).default([]),
});

export const askAiResponseSchema = z.object({
  answerText: z.string().min(1),
  factualPoints: z.array(z.string().min(1)).max(6),
  uncertaintyNote: z.string().nullable(),
  parserMode: z.enum(["openai", "deterministic"]),
  retrievalMode: z.enum(["hybrid", "facts-only"]),
  retrievalMatchCount: z.number().int().min(0).max(20),
  resolvedPeriod: z.enum(["today", "week", "month", "year", "overall", "custom"]),
  resolvedPeriodLabel: z.string().min(1),
  interpretation: z.object({
    personFilter: z.string().nullable(),
    categoryFilter: z.string().nullable(),
    periodQuery: z.string().nullable(),
    focus: askAiFocusSchema,
    confidence: z.number().min(0).max(1),
  }).nullable(),
});

export type AskAiRequest = z.infer<typeof askAiRequestSchema>;
export type AskAiResponse = z.infer<typeof askAiResponseSchema>;
export type AskAiConversationMessage = z.infer<
  typeof askAiConversationMessageSchema
>;
export type AskAiReplyLanguage = z.infer<typeof askAiReplyLanguageSchema>;

export const askAiJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answerText: { type: "string" },
    factualPoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    uncertaintyNote: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
  required: [
    "answerText",
    "factualPoints",
    "uncertaintyNote",
  ],
} as const;
