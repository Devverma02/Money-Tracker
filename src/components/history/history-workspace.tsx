"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { HistoryEntry } from "@/lib/ledger/history-types";

type HistoryWorkspaceProps = {
  entries: HistoryEntry[];
};

const correctionTypes = [
  { value: "", label: "Keep current type" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "loan_given", label: "Loan given" },
  { value: "loan_taken", label: "Loan taken" },
  { value: "loan_received_back", label: "Loan received back" },
  { value: "loan_repaid", label: "Loan repaid" },
  { value: "savings_deposit", label: "Savings deposit" },
  { value: "note", label: "Note" },
] as const;

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

export function HistoryWorkspace({ entries }: HistoryWorkspaceProps) {
  const router = useRouter();
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCorrectionSubmit = (entryId: string, formData: FormData) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      const payload = {
        amount: formData.get("amount")
          ? Number(formData.get("amount"))
          : undefined,
        entryType: formData.get("entryType") || undefined,
        category: formData.get("category") || undefined,
        personName: formData.get("personName") || undefined,
        note: formData.get("note") || undefined,
        resolvedDate: formData.get("resolvedDate") || undefined,
        reason: formData.get("reason") || undefined,
      };

      try {
        const response = await fetch(`/api/entries/${entryId}/correct`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "The correction could not be saved.");
        }

        setSuccess(data.message ?? "The correction was saved.");
        setOpenEntryId(null);
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The correction could not be saved.",
        );
      }
    });
  };

  const handleUndo = (entryId: string) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`/api/entries/${entryId}/undo`, {
          method: "POST",
        });
        const data = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "The undo action failed.");
        }

        setSuccess(data.message ?? "The last correction was undone.");
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "The undo action failed.",
        );
      }
    });
  };

  return (
    <section className="grid gap-5">
      <div className="shell-card rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-brand">History</p>
            <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950 sm:text-4xl">
              Recent entries
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Check old saves, open edit only when needed, and undo the latest correction if required.
            </p>
          </div>
          <div className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-medium text-slate-600">
            {entries.length} entries
          </div>
        </div>

        {error ? (
          <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="status-positive mt-4 rounded-2xl border px-4 py-3 text-sm">
            {success}
          </p>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="soft-card rounded-[1.6rem] px-6 py-8 text-sm leading-7 text-slate-600">
          No saved entries yet. Create your first reviewed entry from the dashboard.
        </div>
      ) : null}

      {entries.map((entry) => (
        <article key={entry.id} className="soft-card rounded-[1.5rem] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-2xl font-semibold text-slate-950">
                  {formatCurrency(entry.amount)}
                </h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {entry.entryType.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {entry.entryDate.slice(0, 10)}
                </span>
              </div>

              <p className="text-sm leading-7 text-slate-600">
                {entry.personName ? `${entry.personName} | ` : ""}
                {entry.category ?? "Uncategorized"}
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Corrections: {entry.correctionCount}
                {entry.lastCorrectionAt
                  ? ` | last update ${entry.lastCorrectionAt.slice(0, 10)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setOpenEntryId((current) =>
                    current === entry.id ? null : entry.id,
                  )
                }
                className="secondary-button rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {openEntryId === entry.id ? "Close edit" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => handleUndo(entry.id)}
                disabled={isPending || entry.correctionCount === 0}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Undo
              </button>
            </div>
          </div>

          {openEntryId !== entry.id ? (
            <details className="mt-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-600">
                Show note
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {entry.note ?? entry.sourceText ?? "No extra note saved for this entry."}
              </p>
            </details>
          ) : null}

          {openEntryId === entry.id ? (
            <form
              action={(formData) => handleCorrectionSubmit(entry.id, formData)}
              className="mt-5 grid gap-4 rounded-[1.4rem] border border-white/70 bg-white/70 p-4 md:grid-cols-2"
            >
              <label className="text-sm font-semibold text-slate-700">
                Updated amount
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  className="field mt-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Updated type
                <select
                  name="entryType"
                  className="field mt-2"
                  defaultValue=""
                >
                  {correctionTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Updated category
                <input
                  name="category"
                  type="text"
                  className="field mt-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Person
                <input
                  name="personName"
                  type="text"
                  className="field mt-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Updated date
                <input
                  name="resolvedDate"
                  type="date"
                  className="field mt-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Reason
                <input
                  name="reason"
                  type="text"
                  placeholder="Example: amount was incorrect"
                  className="field mt-2"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Note
                <textarea
                  name="note"
                  className="field mt-2 min-h-28 resize-none"
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className="primary-button rounded-full px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
              >
                {isPending ? "Saving correction..." : "Save correction"}
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}
