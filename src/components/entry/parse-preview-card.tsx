import type { ParsedAction } from "@/lib/ai/parse-contract";

const entryTypeLabels: Record<string, string> = {
  expense: "Expense",
  income: "Income",
  loan_given: "Loan given",
  loan_taken: "Loan taken",
  loan_received_back: "Loan received back",
  loan_repaid: "Loan repaid",
  savings_deposit: "Savings deposit",
  note: "Note",
};

type ParsePreviewCardProps = {
  action: ParsedAction;
  index: number;
  isReadyToSave?: boolean;
  isSelected?: boolean;
  canSelect?: boolean;
  onToggleSelect?: () => void;
};

export function ParsePreviewCard({
  action,
  index,
  isReadyToSave = false,
  isSelected = false,
  canSelect = false,
  onToggleSelect,
}: ParsePreviewCardProps) {
  return (
    <article className="soft-card rounded-[1rem] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow text-brand">Action {index + 1}</p>
          <h3 className="mt-3 font-mono text-2xl font-semibold text-slate-950">
            {action.entryType ? entryTypeLabels[action.entryType] : "Needs clarification"}
          </h3>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
          <p className="font-mono text-3xl font-semibold text-slate-950">
            {action.amount ? `Rs ${action.amount}` : "Amount unclear"}
          </p>
          <p
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              isReadyToSave ? "status-positive" : "status-warn"
            }`}
          >
            {isReadyToSave ? "Ready to save" : "Clarification needed"}
          </p>
          {canSelect ? (
            <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Select entry
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-[0.85rem] bg-white px-4 py-3">
          Bucket
          <p className="mt-1 font-semibold text-slate-900">{action.bucket ?? "Not set"}</p>
        </div>
        <div className="rounded-[0.85rem] bg-white px-4 py-3">
          Date
          <p className="mt-1 font-semibold text-slate-900">
            {action.resolvedDate ?? "Not set"}
          </p>
        </div>
        <div className="rounded-[0.85rem] bg-white px-4 py-3">
          Category
          <p className="mt-1 font-semibold text-slate-900">
            {action.category ?? "Not set"}
          </p>
        </div>
        <div className="rounded-[0.85rem] bg-white px-4 py-3">
          Person
          <p className="mt-1 font-semibold text-slate-900">
            {action.personName ?? "Not set"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
        <span className="font-semibold text-slate-950">Source text:</span>{" "}
        {action.sourceText}
      </div>
    </article>
  );
}
