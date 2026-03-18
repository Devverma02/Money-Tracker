import type { DashboardSummary } from "@/lib/summaries/types";

type DashboardSummaryPanelProps = {
  summary: DashboardSummary;
  activeReminderCount?: number;
  overdueReminderCount?: number;
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function DashboardSummaryPanel({
  summary,
  activeReminderCount = 0,
  overdueReminderCount = 0,
}: DashboardSummaryPanelProps) {
  const summaryCards = [
    {
      label: summary.today.label,
      amount: formatCurrency(summary.today.netCashMovement),
      helper: `${summary.today.entryCount} entries | in ${formatCurrency(summary.today.cashInTotal)} | out ${formatCurrency(summary.today.cashOutTotal)}`,
    },
    {
      label: summary.week.label,
      amount: formatCurrency(summary.week.netCashMovement),
      helper: `${summary.week.entryCount} entries | in ${formatCurrency(summary.week.cashInTotal)} | out ${formatCurrency(summary.week.cashOutTotal)}`,
    },
    {
      label: summary.month.label,
      amount: formatCurrency(summary.month.netCashMovement),
      helper: `${summary.month.entryCount} entries | in ${formatCurrency(summary.month.cashInTotal)} | out ${formatCurrency(summary.month.cashOutTotal)}`,
    },
    {
      label: "Active reminders",
      amount: String(activeReminderCount),
      helper: `${overdueReminderCount} overdue reminders`,
    },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Money overview</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-gray-900">
              {card.amount}
            </p>
            <p className="mt-1.5 text-sm text-gray-500">{card.helper}</p>
          </article>
        ))}
      </div>

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Show more details ↓
        </summary>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Pending loans
            </p>
            {summary.pendingLoans.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                No pending receivable or payable loans found.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {summary.pendingLoans.slice(0, 5).map((item) => (
                  <div
                    key={item.personName}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.personName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>To receive: {formatCurrency(item.receivable)}</span>
                      <span>To pay: {formatCurrency(item.payable)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Insight
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              {summary.insightText}
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
              {summary.topSpendingCategory ? (
                <p>
                  Top spending: <span className="font-semibold text-gray-900">{summary.topSpendingCategory.category}</span>{" "}
                  at {formatCurrency(summary.topSpendingCategory.amount)}.
                </p>
              ) : (
                <p>Top category will appear once you save more categorized expenses.</p>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
