import { EntryType } from "@prisma/client";
import type { ParsedAction } from "@/lib/ai/parse-contract";

const entryTypeMap: Record<string, EntryType> = {
  expense: EntryType.EXPENSE,
  income: EntryType.INCOME,
  loan_given: EntryType.LOAN_GIVEN,
  loan_taken: EntryType.LOAN_TAKEN,
  loan_received_back: EntryType.LOAN_RECEIVED_BACK,
  loan_repaid: EntryType.LOAN_REPAID,
  savings_deposit: EntryType.SAVINGS_DEPOSIT,
  note: EntryType.NOTE,
};

export function toLedgerEntryType(entryType: ParsedAction["entryType"]) {
  if (!entryType) {
    return null;
  }

  return entryTypeMap[entryType] ?? null;
}
