import type { ParsedAction } from "@/lib/ai/parse-contract";

type FingerprintInput = {
  userId: string;
  amount: number | null;
  entryType: string | null;
  resolvedDate: string | null;
  personName: string | null;
  category: string | null;
};

function normalizeFingerprintValue(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") ?? "na";
}

export function createDuplicateFingerprint(input: FingerprintInput) {
  const amountPart = input.amount ? String(input.amount) : "na";
  const typePart = normalizeFingerprintValue(input.entryType);
  const datePart = normalizeFingerprintValue(input.resolvedDate);
  const personOrCategory = normalizeFingerprintValue(
    input.personName ?? input.category ?? null,
  );

  return [input.userId, amountPart, typePart, datePart, personOrCategory].join(":");
}

export function createDuplicateFingerprintFromParsedAction(
  userId: string,
  action: ParsedAction,
) {
  return createDuplicateFingerprint({
    userId,
    amount: action.amount,
    entryType: action.entryType,
    resolvedDate: action.resolvedDate,
    personName: action.personName,
    category: action.category,
  });
}
