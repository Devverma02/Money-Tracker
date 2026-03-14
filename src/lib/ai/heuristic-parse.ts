import type {
  ParseRequest,
  ParseResult,
  ParsedAction,
} from "@/lib/ai/parse-contract";

type DetectedDate = {
  dateText: string;
  resolvedDate: string;
  hasExplicitDate: boolean;
};

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

const weekdayMap: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
};

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

  const weekdayShortMap: Record<string, number> = {
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
    weekdayIndex: weekdayShortMap[getValue("weekday")] ?? 1,
  };
}

function formatDateInTimezone(timezone: string, offsetDays = 0) {
  const now = new Date();
  const local = getLocalDateParts(now, timezone);
  const todayStart = zonedDateTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timezone);
  const date = addDays(todayStart, offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSourceText(text: string) {
  return normalizeWhitespace(
    text
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/rs\.?/gi, "rs ")
      .replace(/₹/g, " rs ")
      .replace(/\bkharcha\b/gi, "expense")
      .replace(/\baamdani\b/gi, "income")
      .replace(/\bbachat\b/gi, "savings")
      .replace(/\budhaar\b/gi, "loan")
      .replace(/\bwapas\b/gi, "returned")
      .replace(/\bde diya\b/gi, "gave")
      .replace(/\bdiya\b/gi, "gave")
      .replace(/\ble liya\b/gi, "took")
      .replace(/\bliya\b/gi, "took")
      .replace(/\bmila\b/gi, "received"),
  );
}

function detectAmount(text: string) {
  const amountMatch = text.match(
    /(?:rs\.?|₹|rupaye?|rupees?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(k|thousand|lakh|lac|lakhs))?/i,
  );

  if (!amountMatch) {
    return null;
  }

  const rawAmount = Number(amountMatch[1].replaceAll(",", ""));

  if (!Number.isFinite(rawAmount)) {
    return null;
  }

  const suffix = amountMatch[2]?.toLowerCase();

  if (suffix === "k" || suffix === "thousand") {
    return rawAmount * 1000;
  }

  if (suffix === "lakh" || suffix === "lac" || suffix === "lakhs") {
    return rawAmount * 100000;
  }

  return rawAmount;
}

function detectEntryType(text: string) {
  if (/(loan).*(took|from|se liya)/i.test(text)) {
    return "loan_taken" as const;
  }

  if (/(loan).*(gave|ko diya)/i.test(text)) {
    return "loan_given" as const;
  }

  if (/(returned back|received back|loan aya|loan aaya)/i.test(text)) {
    return "loan_received_back" as const;
  }

  if (/(loan repaid|loan chukaya|returned to|paid back|wapis diya)/i.test(text)) {
    return "loan_repaid" as const;
  }

  if (/(savings|save kiya|saving|deposit|jama)/i.test(text)) {
    return "savings_deposit" as const;
  }

  if (/(salary|income|earned|received|kamaya)/i.test(text)) {
    return "income" as const;
  }

  if (
    /(expense|spent|spend|bought|bill|groceries|grocery|petrol|rent|medicine|health|fuel|travel)/i.test(
      text,
    )
  ) {
    return "expense" as const;
  }

  return null;
}

function detectCategory(text: string) {
  const mappings: Array<[RegExp, string]> = [
    [/(sabzi|doodh|ration|grocery|groceries|vegetable|milk)/i, "ghar"],
    [/(petrol|diesel|fuel|auto|cab|travel|bus|train)/i, "travel"],
    [/(kiraya|rent|room rent)/i, "rent"],
    [/(dawai|medicine|doctor|hospital|health)/i, "health"],
    [/(salary|kamaya|income|earned)/i, "income"],
    [/(bachat|saving|savings|deposit|jama)/i, "savings"],
  ];

  const match = mappings.find(([pattern]) => pattern.test(text));
  return match?.[1] ?? null;
}

function normalizePersonName(name: string | null) {
  if (!name) {
    return null;
  }

  const cleaned = name
    .replace(/\b(aaj|kal|parso|today|yesterday|last)\b/gi, " ")
    .replace(/\b(ji|bhai|sir|madam|bhabhi|bhabhi ji)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function detectPersonName(text: string) {
  const patterns = [
    /\bto\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:for|on|yesterday|today|kal|parso)|$)/i,
    /\bfrom\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:for|on|yesterday|today|kal|parso)|$)/i,
    /\b([A-Za-z][A-Za-z\s]{1,30}?)\s+(?:ko|se)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return normalizePersonName(match[1]);
    }
  }

  return null;
}

function detectBucket(text: string, allowedBucketList: string[]) {
  const matchedBucket = allowedBucketList.find((bucket) =>
    new RegExp(`\\b${bucket}\\b`, "i").test(text),
  );

  return matchedBucket ?? allowedBucketList[0] ?? "personal";
}

function buildResolvedDate(timezone: string, year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(zonedDateTimeToUtc(year, month, day, 0, 0, 0, timezone));
}

function resolveWeekdayDate(text: string, timezone: string) {
  const weekdayMatch = text.match(
    /\b(?:last\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i,
  );

  if (!weekdayMatch) {
    return null;
  }

  const local = getLocalDateParts(new Date(), timezone);
  const targetWeekday = weekdayMap[weekdayMatch[1].toLowerCase()];
  let dayDiff = local.weekdayIndex - targetWeekday;

  if (dayDiff <= 0) {
    dayDiff += 7;
  }

  if (/last\s+/i.test(weekdayMatch[0])) {
    dayDiff += 7;
  }

  const todayStart = zonedDateTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timezone);
  const targetDate = addDays(todayStart, -dayDiff);

  return {
    dateText: normalizeWhitespace(weekdayMatch[0].toLowerCase()),
    resolvedDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(targetDate),
    hasExplicitDate: true,
  } satisfies DetectedDate;
}

function detectDate(
  text: string,
  timezone: string,
  fallbackDate?: Pick<DetectedDate, "dateText" | "resolvedDate"> | null,
): DetectedDate {
  const cleanText = text.toLowerCase();
  const local = getLocalDateParts(new Date(), timezone);

  const ddmmyyyyMatch = cleanText.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);

  if (ddmmyyyyMatch) {
    const day = Number(ddmmyyyyMatch[1]);
    const month = Number(ddmmyyyyMatch[2]);
    const yearRaw = ddmmyyyyMatch[3];
    const year =
      yearRaw === undefined
        ? local.year
        : yearRaw.length === 2
          ? 2000 + Number(yearRaw)
          : Number(yearRaw);

    return {
      dateText: ddmmyyyyMatch[0],
      resolvedDate: buildResolvedDate(timezone, year, month, day),
      hasExplicitDate: true,
    };
  }

  const monthNameMatch = cleanText.match(
    /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+(20\d{2}))?\b|\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:\s+(20\d{2}))?\b/,
  );

  if (monthNameMatch) {
    const monthToken = monthNameMatch[2] ?? monthNameMatch[4];
    const dayToken = monthNameMatch[1] ?? monthNameMatch[5];
    const yearToken = monthNameMatch[3] ?? monthNameMatch[6];
    const month = monthMap[monthToken];
    const day = Number(dayToken);
    const year = Number(yearToken ?? local.year);

    return {
      dateText: monthNameMatch[0],
      resolvedDate: buildResolvedDate(timezone, year, month, day),
      hasExplicitDate: true,
    };
  }

  const daysAgoMatch = cleanText.match(/\b(\d{1,2})\s+(day|days|din)\s+ago\b/);

  if (daysAgoMatch) {
    const days = Number(daysAgoMatch[1]);

    return {
      dateText: daysAgoMatch[0],
      resolvedDate: formatDateInTimezone(timezone, -days),
      hasExplicitDate: true,
    };
  }

  const weekdayDate = resolveWeekdayDate(cleanText, timezone);

  if (weekdayDate) {
    return weekdayDate;
  }

  if (/\b(parso|day before yesterday)\b/.test(cleanText)) {
    return {
      dateText: "parso",
      resolvedDate: formatDateInTimezone(timezone, -2),
      hasExplicitDate: true,
    };
  }

  if (/\b(kal|yesterday)\b/.test(cleanText)) {
    return {
      dateText: "kal",
      resolvedDate: formatDateInTimezone(timezone, -1),
      hasExplicitDate: true,
    };
  }

  if (/\b(aaj|today)\b/.test(cleanText)) {
    return {
      dateText: "aaj",
      resolvedDate: formatDateInTimezone(timezone, 0),
      hasExplicitDate: true,
    };
  }

  if (fallbackDate) {
    return {
      dateText: fallbackDate.dateText,
      resolvedDate: fallbackDate.resolvedDate,
      hasExplicitDate: false,
    };
  }

  return {
    dateText: "aaj",
    resolvedDate: formatDateInTimezone(timezone, 0),
    hasExplicitDate: false,
  };
}

function hasActionSignal(text: string) {
  return Boolean(
    detectAmount(text) ??
      detectEntryType(text) ??
      detectCategory(text) ??
      detectPersonName(text) ??
      (/\b(today|aaj|kal|parso|\d{1,2}[\/\-]\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
        text,
      )
        ? "date"
        : null),
  );
}

function splitIntoCandidateSegments(text: string) {
  const normalized = normalizeSourceText(text)
    .replace(/\s*([.;!?])\s*/g, "$1 ")
    .trim();

  const rawSegments = normalized
    .split(/\s*(?:[.;!?]+|\n+|(?:,\s+(?=[a-z0-9]))|\b(?:aur|and|then|phir)\b)\s*/i)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  const actionSegments = rawSegments.filter(hasActionSignal);

  if (actionSegments.length <= 1) {
    return [normalized];
  }

  return actionSegments;
}

function isActionReady(action: ParsedAction) {
  return Boolean(
    action.entryType &&
      action.resolvedDate &&
      (action.amount !== null || action.entryType === "note"),
  );
}

function buildClarificationQuestion(actions: ParsedAction[]) {
  const firstUnclearIndex = actions.findIndex((action) => !isActionReady(action));

  if (firstUnclearIndex === -1) {
    return null;
  }

  const action = actions[firstUnclearIndex];
  const label = `item ${firstUnclearIndex + 1}`;

  if (action.amount === null && action.entryType !== "note") {
    return `What is the amount for ${label}?`;
  }

  if (!action.entryType) {
    return `For ${label}, is this an expense, income, or loan-related entry?`;
  }

  if (!action.resolvedDate) {
    return `Which date should I use for ${label}?`;
  }

  return "One of the items still needs clarification before it can be saved.";
}

function buildSummaryText(actions: ParsedAction[], needsClarification: boolean) {
  const readyCount = actions.filter(isActionReady).length;
  const blockedCount = actions.length - readyCount;

  if (actions.length === 1 && !needsClarification) {
    return "One entry is ready to review and save.";
  }

  if (actions.length === 1) {
    return "One entry was found, but it still needs clarification.";
  }

  if (!needsClarification) {
    return `${actions.length} entries were identified and are ready for review.`;
  }

  return `${readyCount} entries are ready. ${blockedCount} still need clarification before they can be saved.`;
}

export function parseMoneyInputHeuristically(request: ParseRequest): ParseResult {
  const cleanText = normalizeSourceText(request.inputText);
  const overallEntryType = detectEntryType(cleanText);
  const overallDate = detectDate(cleanText, request.timezone);
  const segments = splitIntoCandidateSegments(cleanText);
  let inheritedDate: Pick<DetectedDate, "dateText" | "resolvedDate"> | null =
    overallDate.hasExplicitDate
      ? {
          dateText: overallDate.dateText,
          resolvedDate: overallDate.resolvedDate,
        }
      : null;

  const actions = segments.map((segment) => {
    const detectedDate = detectDate(segment, request.timezone, inheritedDate);

    if (detectedDate.hasExplicitDate) {
      inheritedDate = {
        dateText: detectedDate.dateText,
        resolvedDate: detectedDate.resolvedDate,
      };
    }

    return {
      intentType: "create_entry" as const,
      amount: detectAmount(segment),
      entryType: detectEntryType(segment) ?? overallEntryType,
      category: detectCategory(segment),
      bucket: detectBucket(segment, request.allowedBuckets),
      personName: detectPersonName(segment),
      note: segment,
      dateText: detectedDate.dateText,
      resolvedDate: detectedDate.resolvedDate,
      sourceText: segment,
    };
  });

  const clarificationQuestion = buildClarificationQuestion(actions);
  const needsClarification = clarificationQuestion !== null;

  return {
    actions,
    confidence: needsClarification ? 0.52 : actions.length > 1 ? 0.82 : 0.76,
    needsClarification,
    clarificationQuestion,
    parserMode: "heuristic",
    summaryText: buildSummaryText(actions, needsClarification),
  };
}
