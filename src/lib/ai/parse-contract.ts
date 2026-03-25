import { z } from "zod";

export const allowedEntryTypes = [
  "expense",
  "income",
  "loan_given",
  "loan_taken",
  "loan_received_back",
  "loan_repaid",
  "savings_deposit",
  "note",
] as const;

export const allowedBuckets = ["personal", "ghar", "dukaan", "kheti"] as const;

export const parseRequestSchema = z.object({
  inputText: z.string().trim().min(2).max(400),
  locale: z.string().default("hi-IN"),
  timezone: z.string().default("Asia/Kolkata"),
  allowedBuckets: z.array(z.string()).default(["personal"]),
  knownPeople: z.array(z.string().trim().min(1).max(120)).max(120).default([]),
  knownCategories: z.array(z.string().trim().min(1).max(120)).max(120).default([]),
});

export const parsedActionSchema = z.object({
  intentType: z.literal("create_entry"),
  amount: z.number().nullable(),
  entryType: z.enum(allowedEntryTypes).nullable(),
  category: z.string().nullable(),
  bucket: z.string().nullable(),
  personName: z.string().nullable(),
  note: z.string().nullable(),
  dateText: z.string().nullable(),
  resolvedDate: z.string().nullable(),
  sourceText: z.string().min(1),
  resolvedPersonId: z.string().uuid().nullable().optional(),
  createPersonLabel: z.string().trim().min(2).max(80).nullable().optional(),
});

export const parseResultSchema = z.object({
  actions: z.array(parsedActionSchema),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  parserMode: z.enum(["openai", "heuristic"]),
  summaryText: z.string(),
});

export type ParseRequest = z.infer<typeof parseRequestSchema>;
export type ParsedAction = z.infer<typeof parsedActionSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;

export const parserJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          intentType: {
            type: "string",
            enum: ["create_entry"],
          },
          amount: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
          entryType: {
            anyOf: [
              {
                type: "string",
                enum: [...allowedEntryTypes],
              },
              { type: "null" },
            ],
          },
          category: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          bucket: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          personName: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          note: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          dateText: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          resolvedDate: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          sourceText: {
            type: "string",
          },
        },
        required: [
          "intentType",
          "amount",
          "entryType",
          "category",
          "bucket",
          "personName",
          "note",
          "dateText",
          "resolvedDate",
          "sourceText",
        ],
      },
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    needsClarification: {
      type: "boolean",
    },
    clarificationQuestion: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    parserMode: {
      type: "string",
      enum: ["openai", "heuristic"],
    },
    summaryText: {
      type: "string",
    },
  },
  required: [
    "actions",
    "confidence",
    "needsClarification",
    "clarificationQuestion",
    "parserMode",
    "summaryText",
  ],
} as const;
