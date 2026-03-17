import { serverEnv } from "@/lib/env/server";
import {
  reminderParseRequestSchema,
  reminderParseResultSchema,
  reminderParserJsonSchema,
  type ParsedReminderDraft,
  type ReminderParseRequest,
  type ReminderParseResult,
} from "@/lib/reminders/reminder-parse-contract";

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

function parseOffsetLabel(offsetLabel: string) {
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const offsetLabel =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";

  return parseOffsetLabel(offsetLabel);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const roughUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getTimeZoneOffsetMinutes(roughUtc, timeZone);
  return new Date(roughUtc.getTime() - offsetMinutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getLocalDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: Number(getValue("year")),
    month: Number(getValue("month")),
    day: Number(getValue("day")),
    weekdayIndex: weekdayMap[getValue("weekday")] ?? 1,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSourceText(value: string) {
  return normalizeWhitespace(
    value
      .replace(/[â€œâ€]/g, '"')
      .replace(/[â€˜â€™]/g, "'")
      .replace(/â‚¹/g, " rs ")
      .replace(/\byaad dila do\b/gi, " remind ")
      .replace(/\byaad dilana\b/gi, " remind ")
      .replace(/\byaad dilaa do\b/gi, " remind ")
      .replace(/\breminder lagao\b/gi, " remind ")
      .replace(/\breminder bana do\b/gi, " remind ")
      .replace(/\bremind me\b/gi, " remind ")
      .replace(/\bmat bhoolna\b/gi, " remind ")
      .replace(/\byaad rakhna\b/gi, " remind "),
  );
}

function formatIsoDateLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatIsoDateTimeLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function detectPersonName(text: string) {
  const patterns = [
    /\b([A-Za-z][A-Za-z\s]{1,30}?)\s+(?:ko|se)\b/i,
    /\bwith\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s|$)/i,
    /\bfor\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const cleaned = normalizeWhitespace(
        match[1].replace(/\b(ji|bhai|sir|madam|bhabhi)\b/gi, " "),
      );

      if (cleaned) {
        return titleCase(cleaned);
      }
    }
  }

  return null;
}

type ResolvedReminderDate = {
  year: number;
  month: number;
  day: number;
  label: string;
};

function resolveFutureWeekday(text: string, timeZone: string) {
  const match = text.match(
    /\b(?:next|agla|agle)?\s*(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/i,
  );

  if (!match) {
    return null;
  }

  const weekdayMap: Record<string, number> = {
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
    sunday: 7,
    sun: 7,
  };

  const local = getLocalDateParts(new Date(), timeZone);
  const todayStart = zonedDateTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timeZone);
  const targetWeekday = weekdayMap[match[1].toLowerCase()];
  let dayDiff = targetWeekday - local.weekdayIndex;

  if (dayDiff <= 0) {
    dayDiff += 7;
  }

  if (/\b(next|agla|agle)\b/i.test(match[0])) {
    dayDiff += 7;
  }

  const targetDate = addDays(todayStart, dayDiff);
  const parts = getLocalDateParts(targetDate, timeZone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    label: titleCase(match[1]),
  } satisfies ResolvedReminderDate;
}

function resolveReminderDate(text: string, timeZone: string) {
  const normalized = text.toLowerCase();
  const now = new Date();
  const local = getLocalDateParts(now, timeZone);
  const base = zonedDateTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timeZone);

  const numericMatch = normalized.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);

  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    const yearRaw = numericMatch[3];
    const year =
      yearRaw === undefined
        ? local.year
        : yearRaw.length === 2
          ? 2000 + Number(yearRaw)
          : Number(yearRaw);

    return {
      year,
      month,
      day,
      label: numericMatch[0],
    } satisfies ResolvedReminderDate;
  }

  const monthMap: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };

  const monthMatch = normalized.match(
    /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+(20\d{2}))?\b|\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:\s+(20\d{2}))?\b/,
  );

  if (monthMatch) {
    const monthToken = monthMatch[2] ?? monthMatch[4];
    const dayToken = monthMatch[1] ?? monthMatch[5];
    const yearToken = monthMatch[3] ?? monthMatch[6];

    return {
      year: Number(yearToken ?? local.year),
      month: monthMap[monthToken],
      day: Number(dayToken),
      label: monthMatch[0],
    } satisfies ResolvedReminderDate;
  }

  const weekdayDate = resolveFutureWeekday(normalized, timeZone);

  if (weekdayDate) {
    return weekdayDate;
  }

  const inDaysMatch = normalized.match(/\b(?:in\s+)?(\d{1,2})\s+(day|days|din)\s+(?:later|baad)\b/);

  if (inDaysMatch) {
    const target = addDays(base, Number(inDaysMatch[1]));
    const parts = getLocalDateParts(target, timeZone);

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      label: inDaysMatch[0],
    } satisfies ResolvedReminderDate;
  }

  if (/\b(day after tomorrow|parso)\b/.test(normalized)) {
    const target = addDays(base, 2);
    const parts = getLocalDateParts(target, timeZone);

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      label: "day after tomorrow",
    } satisfies ResolvedReminderDate;
  }

  if (/\b(tomorrow|kal)\b/.test(normalized)) {
    const target = addDays(base, 1);
    const parts = getLocalDateParts(target, timeZone);

    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      label: "tomorrow",
    } satisfies ResolvedReminderDate;
  }

  if (/\b(today|aaj)\b/.test(normalized)) {
    return {
      year: local.year,
      month: local.month,
      day: local.day,
      label: "today",
    } satisfies ResolvedReminderDate;
  }

  return null;
}

type ResolvedReminderTime = {
  hour: number;
  minute: number;
  label: string;
  assumed: boolean;
};

function resolveReminderTime(text: string) {
  const normalized = text.toLowerCase();
  const explicitTimePatterns = [
    /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/,
    /\b(\d{1,2})\s*(am|pm)\b/,
    /\b(\d{1,2})(?::(\d{2}))?\s*(baje|bajey|o'clock)\b/,
  ];

  for (const pattern of explicitTimePatterns) {
    const explicitMatch = normalized.match(pattern);

    if (!explicitMatch) {
      continue;
    }

    let hour = Number(explicitMatch[1]);
    const minute = Number(explicitMatch[2] ?? "0");
    const meridiem =
      explicitMatch[3] === "am" || explicitMatch[3] === "pm"
        ? explicitMatch[3]
        : null;

    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    }

    if (meridiem === "am" && hour === 12) {
      hour = 0;
    }

    if (!meridiem) {
      if (/\b(shaam|evening|raat|night)\b/.test(normalized) && hour < 12) {
        hour += 12;
      } else if (/\b(dopahar|afternoon)\b/.test(normalized) && hour < 12) {
        hour = hour === 12 ? 12 : hour + 12;
      }
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const label = meridiem
        ? `${explicitMatch[1]}:${String(minute).padStart(2, "0")} ${meridiem}`
        : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      return {
        hour,
        minute,
        label,
        assumed: false,
      } satisfies ResolvedReminderTime;
    }
  }

  const generalTimes: Array<[RegExp, number, string]> = [
    [/\b(subah|morning)\b/, 9, "morning"],
    [/\b(dopahar|afternoon)\b/, 14, "afternoon"],
    [/\b(shaam|evening)\b/, 18, "evening"],
    [/\b(raat|night)\b/, 21, "night"],
  ];

  for (const [pattern, hour, label] of generalTimes) {
    if (pattern.test(normalized)) {
      return {
        hour,
        minute: 0,
        label,
        assumed: false,
      } satisfies ResolvedReminderTime;
    }
  }

  return null;
}

function cleanReminderTitle(text: string) {
  const cleaned = normalizeWhitespace(
    text
      .replace(/\b(today|tomorrow|day after tomorrow|aaj|kal|parso)\b/gi, " ")
      .replace(/\b(next|agla|agle)\s+(monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/gi, " ")
      .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, " ")
      .replace(/\b\d{1,2}\s+(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+20\d{2})?\b/gi, " ")
      .replace(/\b(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+\d{1,2}(?:\s+20\d{2})?\b/gi, " ")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:baje|bajey|o'clock)?\b/gi, " ")
      .replace(/\b(subah|morning|dopahar|afternoon|shaam|evening|raat|night)\b/gi, " ")
      .replace(/\b(remind|reminder|follow up|follow-up|yaad|dilana|dila|lagao|bana do|mat bhoolna|please|mujhe)\b/gi, " ")
      .replace(/\b(at|on|for|ko|se|about)\b/gi, " ")
      .replace(/[,.!?]/g, " "),
  );

  if (cleaned.length >= 3) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return null;
}

function buildReminderParseResult(params: {
  draft: ParsedReminderDraft | null;
  confidence: number;
  clarificationQuestion: string | null;
  parserMode: "openai" | "heuristic";
  summaryText: string;
}) {
  return reminderParseResultSchema.parse({
    draft: params.draft,
    confidence: params.confidence,
    needsClarification: params.clarificationQuestion !== null,
    clarificationQuestion: params.clarificationQuestion,
    parserMode: params.parserMode,
    summaryText: params.summaryText,
  });
}

function parseReminderInputHeuristically(request: ReminderParseRequest): ReminderParseResult {
  const normalizedText = normalizeSourceText(request.inputText);
  const linkedPerson = detectPersonName(normalizedText);
  const date = resolveReminderDate(normalizedText, request.timezone);
  const time = resolveReminderTime(normalizedText);
  const now = new Date();

  if (!date) {
    return buildReminderParseResult({
      draft: null,
      confidence: 0.38,
      clarificationQuestion: "Reminder ke liye future date batayiye, jaise kal ya next Monday.",
      parserMode: "heuristic",
      summaryText: "I understood the reminder intent, but I still need a date.",
    });
  }

  const assumedTime = !time;

  if (!time && /\b(today|aaj)\b/i.test(normalizedText)) {
    return buildReminderParseResult({
      draft: null,
      confidence: 0.44,
      clarificationQuestion: "Aaj ke liye kis time reminder chahiye?",
      parserMode: "heuristic",
      summaryText: "I found the reminder, but today needs a time before saving.",
    });
  }

  const dueAt = zonedDateTimeToUtc(
    date.year,
    date.month,
    date.day,
    time?.hour ?? 9,
    time?.minute ?? 0,
    0,
    request.timezone,
  );

  if (dueAt <= now) {
    return buildReminderParseResult({
      draft: null,
      confidence: 0.41,
      clarificationQuestion: "Please tell me a future date or time for this reminder.",
      parserMode: "heuristic",
      summaryText: "The reminder time looks like it is already in the past.",
    });
  }

  const title =
    cleanReminderTitle(normalizedText) ??
    (linkedPerson ? `Follow up with ${linkedPerson}` : null);

  if (!title) {
    return buildReminderParseResult({
      draft: null,
      confidence: 0.4,
      clarificationQuestion: "Ye reminder kis baat ke liye hai?",
      parserMode: "heuristic",
      summaryText: "I found the date, but the reminder title is still unclear.",
    });
  }

  const dueLabel = assumedTime
    ? `${formatIsoDateLabel(dueAt, request.timezone)} at 9:00 am`
    : formatIsoDateTimeLabel(dueAt, request.timezone);

  return buildReminderParseResult({
    draft: {
      title,
      dueAt: dueAt.toISOString(),
      dueLabel,
      linkedPerson,
      bucket: request.bucket,
      assumedTime,
      sourceText: request.inputText.trim(),
    },
    confidence: assumedTime ? 0.74 : 0.88,
    clarificationQuestion: null,
    parserMode: "heuristic",
    summaryText: assumedTime
      ? "One reminder is ready. I assumed 9:00 am because no time was provided."
      : "One reminder is ready to review and save.",
  });
}

async function parseReminderWithOpenAI(request: ReminderParseRequest) {
  const systemPrompt = [
    "You parse one natural-language reminder request for a trust-first money assistant.",
    "Return only schema-valid JSON.",
    "Extract a single reminder draft with title, dueAt, dueLabel, linkedPerson, bucket, assumedTime, and sourceText.",
    "The reminder must only be save-ready when dueAt is a clear future datetime in the user's timezone.",
    "If the date or time is unclear, set draft=null, needsClarification=true, and ask one short Hinglish clarification question.",
    "If the user gives a future date without a time, you may assume 09:00 local time and set assumedTime=true.",
    "Keep the title concise, factual, and derived from the user's wording.",
    "Never invent people or dates.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    raw_text: request.inputText,
    locale: request.locale,
    timezone: request.timezone,
    bucket: request.bucket,
    now: new Date().toISOString(),
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
          name: "reminder_parse_result",
          strict: true,
          schema: reminderParserJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI reminder parse failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new Error("OpenAI reminder parse returned no structured text.");
  }

  return reminderParseResultSchema.parse(JSON.parse(structuredText));
}

export async function parseReminderInput(input: unknown) {
  const request = reminderParseRequestSchema.parse(input);

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    return parseReminderInputHeuristically(request);
  }

  try {
    const openAiResult = await parseReminderWithOpenAI(request);

    if (
      openAiResult.draft &&
      new Date(openAiResult.draft.dueAt).getTime() <= Date.now()
    ) {
      throw new Error("OpenAI reminder parse returned a past reminder.");
    }

    return reminderParseResultSchema.parse({
      ...openAiResult,
      parserMode: "openai",
    });
  } catch {
    return parseReminderInputHeuristically(request);
  }
}
