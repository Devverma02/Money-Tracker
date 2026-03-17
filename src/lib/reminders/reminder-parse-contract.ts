import { z } from "zod";

export const reminderParseRequestSchema = z.object({
  inputText: z.string().trim().min(3).max(280),
  locale: z.string().default("hi-IN"),
  timezone: z.string().default("Asia/Kolkata"),
  bucket: z.string().trim().min(1).default("personal"),
});

export const parsedReminderDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  dueAt: z.string().datetime(),
  dueLabel: z.string().trim().min(1),
  linkedPerson: z.string().trim().max(80).nullable(),
  bucket: z.string().trim().max(50),
  assumedTime: z.boolean(),
  sourceText: z.string().trim().min(1),
});

export const reminderParseResultSchema = z.object({
  draft: parsedReminderDraftSchema.nullable(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  parserMode: z.enum(["openai", "heuristic"]),
  summaryText: z.string(),
});

export type ReminderParseRequest = z.infer<typeof reminderParseRequestSchema>;
export type ParsedReminderDraft = z.infer<typeof parsedReminderDraftSchema>;
export type ReminderParseResult = z.infer<typeof reminderParseResultSchema>;

export const reminderParserJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            dueAt: { type: "string" },
            dueLabel: { type: "string" },
            linkedPerson: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            bucket: { type: "string" },
            assumedTime: { type: "boolean" },
            sourceText: { type: "string" },
          },
          required: [
            "title",
            "dueAt",
            "dueLabel",
            "linkedPerson",
            "bucket",
            "assumedTime",
            "sourceText",
          ],
        },
        { type: "null" },
      ],
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
    "draft",
    "confidence",
    "needsClarification",
    "clarificationQuestion",
    "parserMode",
    "summaryText",
  ],
} as const;
