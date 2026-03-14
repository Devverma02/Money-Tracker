import type { DashboardSummary } from "@/lib/summaries/types";

type DashboardSummaryPanelProps = {
  summary: DashboardSummary;
};

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

export function DashboardSummaryPanel({
  summary,
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
  ];

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-brand">Summary</p>
          <h2 className="mt-2 font-mono text-2xl font-semibold text-slate-950 sm:text-3xl">
            Money overview
          </h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="soft-card rounded-[1.5rem] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 font-mono text-3xl font-semibold text-slate-950">
              {card.amount}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.helper}</p>
          </article>
        ))}
      </div>

      <details className="soft-card rounded-[1.6rem] p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
          Show more summary details
        </summary>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.3rem] border border-white/70 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending loans
            </p>
            {summary.pendingLoans.length === 0 ? (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                No pending receivable or payable loans were found in your saved entries.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {summary.pendingLoans.slice(0, 5).map((item) => (
                  <div
                    key={item.personName}
                    className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-slate-950">{item.personName}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span>To receive: {formatCurrency(item.receivable)}</span>
                      <span>To pay: {formatCurrency(item.payable)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-[1.3rem] border border-white/70 bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Insight
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {summary.insightText}
            </p>
            <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-600">
              {summary.topSpendingCategory ? (
                <p>
                  Top spending category:{" "}
                  <span className="font-semibold text-slate-950">
                    {summary.topSpendingCategory.category}
                  </span>{" "}
                  at {formatCurrency(summary.topSpendingCategory.amount)}.
                </p>
              ) : (
                <p>
                  A top category will appear here once you save more categorized expense entries.
                </p>
              )}
            </div>
          </article>
        </div>
      </details>
    </section>
  );
}
