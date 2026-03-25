import { z } from "zod";

export const askAiFocusSchema = z.enum([
  "general",
  "balance",
  "loans",
  "income",
  "expense",
  "history",
  "reminder",
  "person",
  "category",
]);

export const askAiInterpretationSchema = z.object({
  interpretedQuestion: z.string().trim().min(1).max(400),
  personFilter: z.string().trim().min(1).max(120).nullable(),
  categoryFilter: z.string().trim().min(1).max(120).nullable(),
  periodQuery: z.string().trim().min(1).max(120).nullable(),
  focus: askAiFocusSchema,
  confidence: z.number().min(0).max(1),
});

export type AskAiInterpretation = z.infer<typeof askAiInterpretationSchema>;

export const askAiInterpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    interpretedQuestion: { type: "string" },
    personFilter: { anyOf: [{ type: "string" }, { type: "null" }] },
    categoryFilter: { anyOf: [{ type: "string" }, { type: "null" }] },
    periodQuery: { anyOf: [{ type: "string" }, { type: "null" }] },
    focus: {
      type: "string",
      enum: [
        "general",
        "balance",
        "loans",
        "income",
        "expense",
        "history",
        "reminder",
        "person",
        "category",
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
  },
  required: [
    "interpretedQuestion",
    "personFilter",
    "categoryFilter",
    "periodQuery",
    "focus",
    "confidence",
  ],
} as const;
