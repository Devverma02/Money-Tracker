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

  const weekday = getValue("weekday");
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
    weekdayIndex: weekdayMap[weekday] ?? 1,
  };
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

export function getDashboardDateRanges(timeZone: string) {
  const now = new Date();
  const local = getLocalDateParts(now, timeZone);

  const todayStart = zonedDateTimeToUtc(
    local.year,
    local.month,
    local.day,
    0,
    0,
    0,
    timeZone,
  );
  const tomorrowStart = addDays(todayStart, 1);
  const weekStart = addDays(todayStart, -(local.weekdayIndex - 1));
  const nextWeekStart = addDays(weekStart, 7);
  const monthStart = zonedDateTimeToUtc(local.year, local.month, 1, 0, 0, 0, timeZone);
  const nextMonthStart =
    local.month === 12
      ? zonedDateTimeToUtc(local.year + 1, 1, 1, 0, 0, 0, timeZone)
      : zonedDateTimeToUtc(local.year, local.month + 1, 1, 0, 0, 0, timeZone);

  return {
    today: {
      label: "Today",
      start: todayStart,
      endExclusive: tomorrowStart,
    },
    week: {
      label: "This week",
      start: weekStart,
      endExclusive: nextWeekStart,
    },
    month: {
      label: "This month",
      start: monthStart,
      endExclusive: nextMonthStart,
    },
  };
}
