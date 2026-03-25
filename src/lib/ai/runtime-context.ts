export type AiRuntimeContext = {
  timezone: string;
  locale: string;
  nowIso: string;
  todayLocal: string;
  nowLocalLabel: string;
};

export function buildAiRuntimeContext(params: {
  timezone: string;
  locale?: string | null;
  now?: Date;
}): AiRuntimeContext {
  const now = params.now ?? new Date();
  const timezone = params.timezone || "Asia/Kolkata";
  const locale = params.locale?.trim() || "hi-IN";

  const todayLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const nowLocalLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return {
    timezone,
    locale,
    nowIso: now.toISOString(),
    todayLocal,
    nowLocalLabel,
  };
}
