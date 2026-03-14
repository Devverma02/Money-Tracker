import { z } from "zod";

export const askAiRequestSchema = z.object({
  question: z.string().trim().min(3).max(300),
  timezone: z.string().default("Asia/Kolkata"),
});

export const askAiResponseSchema = z.object({
  answerText: z.string().min(1),
  factualPoints: z.array(z.string().min(1)).max(6),
  uncertaintyNote: z.string().nullable(),
  parserMode: z.enum(["openai", "deterministic"]),
  resolvedPeriod: z.enum(["today", "week", "month", "year", "overall", "custom"]),
  resolvedPeriodLabel: z.string().min(1),
});

export type AskAiRequest = z.infer<typeof askAiRequestSchema>;
export type AskAiResponse = z.infer<typeof askAiResponseSchema>;

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
    parserMode: {
      type: "string",
      enum: ["openai", "deterministic"],
    },
    resolvedPeriod: {
      type: "string",
      enum: ["today", "week", "month", "year", "overall", "custom"],
    },
    resolvedPeriodLabel: { type: "string" },
  },
  required: [
    "answerText",
    "factualPoints",
    "uncertaintyNote",
    "parserMode",
    "resolvedPeriod",
    "resolvedPeriodLabel",
  ],
} as const;
