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

const entryTypeColors: Record<string, string> = {
  expense: "border-red-200 bg-red-50 text-red-700",
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  loan_given: "border-orange-200 bg-orange-50 text-orange-700",
  loan_taken: "border-amber-200 bg-amber-50 text-amber-700",
  loan_received_back: "border-teal-200 bg-teal-50 text-teal-700",
  loan_repaid: "border-blue-200 bg-blue-50 text-blue-700",
  savings_deposit: "border-violet-200 bg-violet-50 text-violet-700",
  note: "border-gray-200 bg-gray-50 text-gray-600",
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
  const typeKey = action.entryType ?? "note";
  const typeColor = entryTypeColors[typeKey] ?? entryTypeColors.note;

  return (
    <article className={`rounded-xl border bg-white p-4 transition-all ${isSelected ? "border-[#0d9488] ring-1 ring-[#0d9488]/20" : "border-gray-200"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${typeColor}`}>
            {action.entryType ? entryTypeLabels[action.entryType] : "Unclear"}
          </span>
          <span className="text-xs text-gray-400">Entry {index + 1}</span>
        </div>

        <div className="flex items-center gap-2">
          <p className="font-mono text-xl font-bold text-gray-900">
            {action.amount ? `₹${action.amount.toLocaleString("en-IN")}` : "—"}
          </p>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
              isReadyToSave ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isReadyToSave ? "Ready" : "Needs info"}
          </span>
          {canSelect ? (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
              />
              Select
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        {[
          { label: "Bucket", value: action.bucket },
          { label: "Date", value: action.resolvedDate },
          { label: "Category", value: action.category },
          { label: "Person", value: action.personName },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            <p className="text-[11px] font-medium text-gray-400">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">Source:</span> {action.sourceText}
      </div>
    </article>
  );
}
