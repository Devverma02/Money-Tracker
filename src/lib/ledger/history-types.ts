export type HistoryEntry = {
  id: string;
  amount: number;
  entryType: string;
  category: string | null;
  entryDate: string;
  personName: string | null;
  note: string | null;
  sourceText: string | null;
  correctionCount: number;
  lastCorrectionAt: string | null;
  createdAt: string;
};
