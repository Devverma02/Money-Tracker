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

function formatDateInTimezone(timezone: string, offsetDays = 0) {
  const base = new Date();
  base.setDate(base.getDate() + offsetDays);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function detectAmount(text: string) {
  const amountMatch = text.match(
    /(?:rs\.?|₹|rupaye?|rupees?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(k|thousand))?/i,
  );

  if (!amountMatch) {
    return null;
  }

  const rawAmount = Number(amountMatch[1].replaceAll(",", ""));

  if (!Number.isFinite(rawAmount)) {
    return null;
  }

  if (amountMatch[2]) {
    return rawAmount * 1000;
  }

  return rawAmount;
}

function detectEntryType(text: string) {
  if (/(udhaar|loan).*(diya|de diya|ko diya)/i.test(text)) {
    return "loan_given" as const;
  }

  if (/(udhaar|loan).*(liya|le liya|se liya)/i.test(text)) {
    return "loan_taken" as const;
  }

  if (/(vapas mila|wapas mila|received back|udhaar aya|loan aya)/i.test(text)) {
    return "loan_received_back" as const;
  }

  if (/(loan chukaya|udhaar chukaya|repaid|wapas diya)/i.test(text)) {
    return "loan_repaid" as const;
  }

  if (/(bachat|save kiya|saving|jama kiya|deposit)/i.test(text)) {
    return "savings_deposit" as const;
  }

  if (/(salary|kamaya|aamdani|income|mila)/i.test(text)) {
    return "income" as const;
  }

  if (
    /(kharcha|expense|spend|spent|kharida|bill|sabzi|doodh|petrol|kiraya|medicine|dawai|grocery)/i.test(
      text,
    )
  ) {
    return "expense" as const;
  }

  return null;
}

function detectCategory(text: string) {
  const mappings: Array<[RegExp, string]> = [
    [/(sabzi|doodh|ration|grocery)/i, "ghar"],
    [/(petrol|diesel|fuel)/i, "travel"],
    [/(kiraya|rent)/i, "rent"],
    [/(dawai|medicine|doctor)/i, "health"],
    [/(salary|kamaya|income)/i, "income"],
    [/(bachat|saving)/i, "savings"],
  ];

  const match = mappings.find(([pattern]) => pattern.test(text));
  return match?.[1] ?? null;
}

function detectPersonName(text: string) {
  const personMatch = text.match(/([A-Za-z]+)\s+(ko|se)\s/i);
  return personMatch?.[1] ?? null;
}

function detectBucket(text: string, allowedBucketList: string[]) {
  const matchedBucket = allowedBucketList.find((bucket) =>
    new RegExp(`\\b${bucket}\\b`, "i").test(text),
  );

  return matchedBucket ?? allowedBucketList[0] ?? "personal";
}

function detectDate(
  text: string,
  timezone: string,
  fallbackDate?: Pick<DetectedDate, "dateText" | "resolvedDate"> | null,
): DetectedDate {
  if (/kal/i.test(text)) {
    return {
      dateText: "kal",
      resolvedDate: formatDateInTimezone(timezone, -1),
      hasExplicitDate: true,
    };
  }

  if (/parso/i.test(text)) {
    return {
      dateText: "parso",
      resolvedDate: formatDateInTimezone(timezone, -2),
      hasExplicitDate: true,
    };
  }

  if (/aaj|today/i.test(text)) {
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
      (/kal|parso|aaj|today/i.test(text) ? "date" : null),
  );
}

function splitIntoCandidateSegments(text: string) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s*([.;!?])\s*/g, "$1 ")
    .trim();

  const rawSegments = normalized
    .split(/\s*(?:[.;!?]+|\n+|(?:, (?=[A-Za-z]))|\b(?:aur|and|then|phir)\b)\s*/i)
    .map((segment) => segment.trim())
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
  const cleanText = request.inputText.trim();
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
    confidence: needsClarification ? 0.48 : actions.length > 1 ? 0.8 : 0.74,
    needsClarification,
    clarificationQuestion,
    parserMode: "heuristic",
    summaryText: buildSummaryText(actions, needsClarification),
  };
}
