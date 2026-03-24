import { formatMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";
import type { DashboardSummary } from "@/lib/summaries/types";

type DashboardSummaryPanelProps = {
  summary: DashboardSummary;
  activeReminderCount?: number;
  overdueReminderCount?: number;
  displayName?: string;
  currency: CurrencyCodeValue;
};

export function DashboardSummaryPanel({
  summary,
  activeReminderCount = 0,
  overdueReminderCount = 0,
  displayName = "",
  currency,
}: DashboardSummaryPanelProps) {
  const summaryCards = [
    {
      label: summary.today.label,
      amount: formatMoney(summary.today.netCashMovement, currency),
      helper: `${summary.today.entryCount} entries | in ${formatMoney(summary.today.cashInTotal, currency)} | out ${formatMoney(summary.today.cashOutTotal, currency)}`,
    },
    {
      label: summary.week.label,
      amount: formatMoney(summary.week.netCashMovement, currency),
      helper: `${summary.week.entryCount} entries | in ${formatMoney(summary.week.cashInTotal, currency)} | out ${formatMoney(summary.week.cashOutTotal, currency)}`,
    },
    {
      label: summary.month.label,
      amount: formatMoney(summary.month.netCashMovement, currency),
      helper: `${summary.month.entryCount} entries | in ${formatMoney(summary.month.cashInTotal, currency)} | out ${formatMoney(summary.month.cashOutTotal, currency)}`,
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
        {displayName ? (
          <p className="mt-1 text-sm text-gray-500">Welcome back, {displayName}.</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-400">{card.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-gray-900">{card.amount}</p>
            <p className="mt-1.5 text-sm text-gray-500">{card.helper}</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-gray-900">Monthly report</h3>
          <p className="text-sm text-gray-500">A simple view for this month.</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-medium text-emerald-500">Kitna aaya</p>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-700">
              {formatMoney(summary.monthlyReport.cashInTotal, currency)}
            </p>
          </article>

          <article className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-medium text-red-500">Kitna gaya</p>
            <p className="mt-2 font-mono text-2xl font-bold text-red-700">
              {formatMoney(summary.monthlyReport.cashOutTotal, currency)}
            </p>
          </article>

          <article className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-400">Top category</p>
            <p className="mt-2 text-base font-semibold text-gray-900">
              {summary.monthlyReport.topSpendingCategory?.category ?? "Not enough data"}
            </p>
            {summary.monthlyReport.topSpendingCategory ? (
              <p className="mt-1 text-sm text-gray-500">
                {formatMoney(summary.monthlyReport.topSpendingCategory.amount, currency)}
              </p>
            ) : null}
          </article>

          <article className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-400">Lena / dena baki</p>
            <div className="mt-2 space-y-1.5 text-sm text-gray-600">
              <p>
                Receive:{" "}
                <span className="font-semibold text-gray-900">
                  {summary.monthlyReport.topReceivablePerson
                    ? `${summary.monthlyReport.topReceivablePerson.personName} (${formatMoney(summary.monthlyReport.topReceivablePerson.receivable, currency)})`
                    : "None"}
                </span>
              </p>
              <p>
                Pay:{" "}
                <span className="font-semibold text-gray-900">
                  {summary.monthlyReport.topPayablePerson
                    ? `${summary.monthlyReport.topPayablePerson.personName} (${formatMoney(summary.monthlyReport.topPayablePerson.payable, currency)})`
                    : "None"}
                </span>
              </p>
            </div>
          </article>
        </div>
      </section>

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Show more details
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
                      <span>To receive: {formatMoney(item.receivable, currency)}</span>
                      <span>To pay: {formatMoney(item.payable, currency)}</span>
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
            <p className="mt-3 text-sm leading-6 text-gray-700">{summary.insightText}</p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
              {summary.topSpendingCategory ? (
                <p>
                  Top spending:{" "}
                  <span className="font-semibold text-gray-900">
                    {summary.topSpendingCategory.category}
                  </span>{" "}
                  at {formatMoney(summary.topSpendingCategory.amount, currency)}.
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
