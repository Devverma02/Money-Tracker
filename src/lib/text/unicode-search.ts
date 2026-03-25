export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsNormalizedTerm(text: string, term: string) {
  const normalizedText = normalizeSearchText(text);
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  return ` ${normalizedText} `.includes(` ${normalizedTerm} `);
}

export function containsAnyNormalizedTerm(text: string, terms: string[]) {
  return terms.some((term) => containsNormalizedTerm(text, term));
}
