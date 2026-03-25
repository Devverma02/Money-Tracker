import {
  containsAnyNormalizedTerm,
  normalizeSearchText,
} from "@/lib/text/unicode-search";

export type ResolvedAskPeriod =
  | "today"
  | "week"
  | "month"
  | "year"
  | "overall"
  | "custom";

export type ResolvedAskDateRange = {
  resolvedPeriod: ResolvedAskPeriod;
  label: string;
  start: Date | null;
  endExclusive: Date | null;
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

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
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

function startOfLocalDay(parts: { year: number; month: number; day: number }, timeZone: string) {
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
}

function startOfLocalMonth(parts: { year: number; month: number }, timeZone: string) {
  return zonedDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0, timeZone);
}

function startOfLocalYear(year: number, timeZone: string) {
  return zonedDateTimeToUtc(year, 1, 1, 0, 0, 0, timeZone);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveAskDateRange(question: string, timeZone: string): ResolvedAskDateRange {
  const normalized = normalizeSearchText(question);
  const now = new Date();
  const local = getLocalDateParts(now, timeZone);
  const todayStart = startOfLocalDay(local, timeZone);
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = addDays(todayStart, -(local.weekdayIndex - 1));
  const nextWeekStart = addDays(weekStart, 7);
  const monthStart = startOfLocalMonth(local, timeZone);
  const nextMonthStart = local.month === 12
    ? startOfLocalYear(local.year + 1, timeZone)
    : zonedDateTimeToUtc(local.year, local.month + 1, 1, 0, 0, 0, timeZone);
  const yearStart = startOfLocalYear(local.year, timeZone);
  const nextYearStart = startOfLocalYear(local.year + 1, timeZone);

  if (
    containsAnyNormalizedTerm(normalized, [
      "all time",
      "all-time",
      "overall",
      "lifetime",
      "sab",
      "poora data",
      "पूरा डेटा",
      "complete history",
    ])
  ) {
    return {
      resolvedPeriod: "overall",
      label: "Overall",
      start: null,
      endExclusive: null,
    };
  }

  const lastDaysMatch = normalized.match(/\b(?:last|past|pichhle|pichle)\s+(\d{1,3})\s*(day|days|din)\b/);

  if (lastDaysMatch) {
    const dayCount = Number(lastDaysMatch[1]);
    const start = addDays(todayStart, -(dayCount - 1));

    return {
      resolvedPeriod: "custom",
      label: `Last ${dayCount} days`,
      start,
      endExclusive: tomorrowStart,
    };
  }

  const lastWeeksMatch = normalized.match(/\b(?:last|past|pichhle|pichle)\s+(\d{1,3})\s*(week|weeks|hafte|hafta)\b/);

  if (lastWeeksMatch) {
    const weekCount = Number(lastWeeksMatch[1]);
    const start = addDays(weekStart, -7 * (weekCount - 1));

    return {
      resolvedPeriod: "custom",
      label: `Last ${weekCount} weeks`,
      start,
      endExclusive: tomorrowStart,
    };
  }

  const lastMonthsMatch = normalized.match(/\b(?:last|past|pichhle|pichle)\s+(\d{1,3})\s*(month|months|mahine|mahina)\b/);

  if (lastMonthsMatch) {
    const monthCount = Number(lastMonthsMatch[1]);
    const start = addMonths(monthStart, -(monthCount - 1));

    return {
      resolvedPeriod: "custom",
      label: `Last ${monthCount} months`,
      start,
      endExclusive: tomorrowStart,
    };
  }

  if (containsAnyNormalizedTerm(normalized, ["yesterday", "kal", "कल"])) {
    const start = addDays(todayStart, -1);

    return {
      resolvedPeriod: "custom",
      label: "Yesterday",
      start,
      endExclusive: todayStart,
    };
  }

  if (containsAnyNormalizedTerm(normalized, ["today", "aaj", "आज"])) {
    return {
      resolvedPeriod: "today",
      label: "Today",
      start: todayStart,
      endExclusive: tomorrowStart,
    };
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      "last week",
      "pichhle hafta",
      "pichhle hafte",
      "last hafte",
      "पिछले हफ्ते",
      "पिछला हफ्ता",
    ])
  ) {
    const start = addDays(weekStart, -7);

    return {
      resolvedPeriod: "custom",
      label: "Last week",
      start,
      endExclusive: weekStart,
    };
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      "this week",
      "week",
      "hafte",
      "hafta",
      "weekly",
      "is hafte",
      "इस हफ्ते",
      "हफ्ता",
      "हफ्ते",
    ])
  ) {
    return {
      resolvedPeriod: "week",
      label: "This week",
      start: weekStart,
      endExclusive: nextWeekStart,
    };
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      "last month",
      "pichhla mahina",
      "pichhle mahine",
      "पिछला महीना",
      "पिछले महीने",
    ])
  ) {
    const currentMonthStart = monthStart;
    const start = addMonths(currentMonthStart, -1);

    return {
      resolvedPeriod: "custom",
      label: "Last month",
      start,
      endExclusive: currentMonthStart,
    };
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      "this month",
      "month",
      "mahina",
      "mahine",
      "monthly",
      "is mahine",
      "इस महीने",
      "महीना",
      "महीने",
    ])
  ) {
    return {
      resolvedPeriod: "month",
      label: "This month",
      start: monthStart,
      endExclusive: nextMonthStart,
    };
  }

  if (
    containsAnyNormalizedTerm(normalized, [
      "this year",
      "yearly",
      "year",
      "saal",
      "is saal",
      "इस साल",
      "साल",
    ])
  ) {
    return {
      resolvedPeriod: "year",
      label: "This year",
      start: yearStart,
      endExclusive: nextYearStart,
    };
  }

  const explicitYearMatch = normalized.match(/\b(20\d{2})\b/);

  if (explicitYearMatch) {
    const year = Number(explicitYearMatch[1]);

    return {
      resolvedPeriod: "year",
      label: `${year}`,
      start: startOfLocalYear(year, timeZone),
      endExclusive: startOfLocalYear(year + 1, timeZone),
    };
  }

  const namedMonthMatch = normalized.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b(?:\s+(20\d{2}))?/,
  );

  if (namedMonthMatch) {
    const monthValue = monthMap[namedMonthMatch[1]];
    const yearValue = Number(namedMonthMatch[2] ?? local.year);
    const start = zonedDateTimeToUtc(yearValue, monthValue, 1, 0, 0, 0, timeZone);
    const endExclusive =
      monthValue === 12
        ? startOfLocalYear(yearValue + 1, timeZone)
        : zonedDateTimeToUtc(yearValue, monthValue + 1, 1, 0, 0, 0, timeZone);

    return {
      resolvedPeriod: "custom",
      label: namedMonthMatch[2]
        ? `${titleCase(namedMonthMatch[1])} ${yearValue}`
        : titleCase(namedMonthMatch[1]),
      start,
      endExclusive,
    };
  }

  return {
    resolvedPeriod: "overall",
    label: "Overall",
    start: null,
    endExclusive: null,
  };
}
