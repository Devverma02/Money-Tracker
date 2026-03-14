export type PeriodSummary = {
  label: string;
  rangeStart: string;
  rangeEndExclusive: string;
  cashInTotal: number;
  cashOutTotal: number;
  netCashMovement: number;
  entryCount: number;
};

export type PendingLoanSummary = {
  personName: string;
  receivable: number;
  payable: number;
};

export type DashboardSummary = {
  today: PeriodSummary;
  week: PeriodSummary;
  month: PeriodSummary;
  pendingLoans: PendingLoanSummary[];
  topSpendingCategory: {
    category: string;
    amount: number;
  } | null;
  insightText: string;
};
