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

export type HistoryFilterPeriod = "all" | "today" | "week" | "month";

export type HistoryFilters = {
  page: number;
  pageSize: number;
  entryType: string;
  period: HistoryFilterPeriod;
};

export type HistoryPageData = {
  entries: HistoryEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: HistoryFilters;
};
