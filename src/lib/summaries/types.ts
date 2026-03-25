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
  trackedBalance: {
    openingBalance: number;
    currentBalance: number;
    cashInSinceSetup: number;
    cashOutSinceSetup: number;
  };
  today: PeriodSummary;
  week: PeriodSummary;
  month: PeriodSummary;
  pendingLoans: PendingLoanSummary[];
  topSpendingCategory: {
    category: string;
    amount: number;
  } | null;
  monthlyReport: {
    cashInTotal: number;
    cashOutTotal: number;
    topSpendingCategory: {
      category: string;
      amount: number;
    } | null;
    topReceivablePerson: PendingLoanSummary | null;
    topPayablePerson: PendingLoanSummary | null;
  };
  insightText: string;
};

export type RecurringSuggestion = {
  id: string;
  title: string;
  suggestedText: string;
  amount: number;
  entryType: "expense" | "income" | "savings_deposit";
  category: string | null;
  personName: string | null;
  nextExpectedDate: string;
  patternMonths: number;
};
