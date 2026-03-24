function getDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function getOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

export function formatDateInputForTimeZone(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getTimeZoneDateInput(timeZone: string, daysAhead = 0) {
  const base = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return formatDateInputForTimeZone(base, timeZone);
}

export function combineDateTimeInTimeZone(
  dateValue: string,
  timeValue: string,
  timeZone: string,
) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);

  const wallClockUtcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let resolved = wallClockUtcGuess;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getOffsetMilliseconds(new Date(resolved), timeZone);
    const nextResolved = wallClockUtcGuess - offset;

    if (nextResolved === resolved) {
      break;
    }

    resolved = nextResolved;
  }

  return new Date(resolved).toISOString();
}
