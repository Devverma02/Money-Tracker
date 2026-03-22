"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { HistoryPageData } from "@/lib/ledger/history-types";

type HistoryWorkspaceProps = {
  historyPageData: HistoryPageData;
  basePath?: string;
  sectionId?: string;
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

const filterTypes = [
  { value: "", label: "All types" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "LOAN_GIVEN", label: "Loan given" },
  { value: "LOAN_TAKEN", label: "Loan taken" },
  { value: "LOAN_RECEIVED_BACK", label: "Loan received back" },
  { value: "LOAN_REPAID", label: "Loan repaid" },
  { value: "SAVINGS_DEPOSIT", label: "Savings deposit" },
  { value: "NOTE", label: "Note" },
] as const;

const periodOptions = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

const typeColorMap: Record<string, string> = {
  EXPENSE: "bg-red-50 text-red-700 border-red-200",
  INCOME: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOAN_GIVEN: "bg-amber-50 text-amber-700 border-amber-200",
  LOAN_TAKEN: "bg-orange-50 text-orange-700 border-orange-200",
  LOAN_RECEIVED_BACK: "bg-teal-50 text-teal-700 border-teal-200",
  LOAN_REPAID: "bg-cyan-50 text-cyan-700 border-cyan-200",
  SAVINGS_DEPOSIT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  NOTE: "bg-gray-50 text-gray-600 border-gray-200",
};

function getTypeColor(entryType: string) {
  return typeColorMap[entryType] ?? "bg-gray-50 text-gray-600 border-gray-200";
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatEntryType(entryType: string) {
  return entryType.replaceAll("_", " ").toLowerCase();
}

function buildHistoryHref(params: {
  page?: number;
  type?: string;
  period?: string;
  search?: string;
  basePath?: string;
  sectionId?: string;
}) {
  const searchParams = new URLSearchParams();
  const basePath = params.basePath ?? "/history";

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.type) {
    searchParams.set("type", params.type);
  }

  if (params.period && params.period !== "all") {
    searchParams.set("period", params.period);
  }

  if (params.search) {
    searchParams.set("search", params.search);
  }

  if (params.sectionId) {
    searchParams.set("section", params.sectionId);
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function HistoryWorkspace({
  historyPageData,
  basePath = "/history",
  sectionId,
}: HistoryWorkspaceProps) {
  const router = useRouter();
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState(historyPageData.filters.entryType);
  const [selectedPeriod, setSelectedPeriod] = useState(historyPageData.filters.period);
  const [searchQuery, setSearchQuery] = useState(historyPageData.filters.search ?? "");

  const openEntry = useMemo(
    () =>
      historyPageData.entries.find((entry) => entry.id === openEntryId) ?? null,
    [historyPageData.entries, openEntryId],
  );

  const handleApplyFilters = () => {
    router.push(
      buildHistoryHref({
        page: 1,
        type: selectedType,
        period: selectedPeriod,
        search: searchQuery,
        basePath,
        sectionId,
      }),
    );
  };

  const handleCorrectionSubmit = (entryId: string, formData: FormData) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      const payload = {
        amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
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
    <section className="space-y-3">
      {/* ── Header + Filters ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Entry history</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Browse, filter, and correct past entries.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gray-400"><path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" /></svg>
            {historyPageData.totalCount} entries
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") handleApplyFilters(); }}
            placeholder="Search entries... (name, category, note)"
            className="field rounded-lg text-sm sm:flex-1"
          />
          <select
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            className="field rounded-lg text-sm"
          >
            {filterTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(event) =>
              setSelectedPeriod(event.target.value as typeof selectedPeriod)
            }
            className="field rounded-lg text-sm"
          >
            {periodOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApplyFilters}
            className="primary-button rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Apply
          </button>
        </div>

        {error ? (
          <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{error}</p>
        ) : null}

        {success ? (
          <p className="status-positive mt-3 rounded-lg border px-3 py-2 text-sm">{success}</p>
        ) : null}
      </div>

      {/* ── Entries grid ── */}
      {historyPageData.entries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-gray-400"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-900">No entries found</p>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {historyPageData.entries.map((entry) => (
            <article
              key={entry.id}
              className="group rounded-xl border border-gray-200 bg-white p-3.5 transition-all duration-200 hover:border-gray-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-bold text-gray-900">
                    {formatCurrency(entry.amount)}
                  </p>
                  <span className={`mt-1.5 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${getTypeColor(entry.entryType)}`}>
                    {formatEntryType(entry.entryType)}
                  </span>
                  <p className="mt-2 text-xs text-gray-400">
                    {entry.entryDate.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOpenEntryId((current) => (current === entry.id ? null : entry.id))
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400 transition-all hover:border-gray-300 hover:bg-white hover:text-gray-600"
                  aria-label={openEntryId === entry.id ? "Close entry details" : "Open entry details"}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {historyPageData.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
          <p className="text-gray-500">
            Page <span className="font-semibold text-gray-900">{historyPageData.page}</span> of{" "}
            <span className="font-semibold text-gray-900">{historyPageData.totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Link
              href={buildHistoryHref({
                page: historyPageData.page - 1,
                type: historyPageData.filters.entryType,
                period: historyPageData.filters.period,
                search: historyPageData.filters.search,
                basePath,
                sectionId,
              })}
              aria-disabled={historyPageData.page <= 1}
              className={`secondary-button rounded-lg px-3 py-1.5 text-sm font-medium ${
                historyPageData.page <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              ← Previous
            </Link>
            <Link
              href={buildHistoryHref({
                page: historyPageData.page + 1,
                type: historyPageData.filters.entryType,
                period: historyPageData.filters.period,
                search: historyPageData.filters.search,
                basePath,
                sectionId,
              })}
              aria-disabled={historyPageData.page >= historyPageData.totalPages}
              className={`secondary-button rounded-lg px-3 py-1.5 text-sm font-medium ${
                historyPageData.page >= historyPageData.totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              Next →
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Detail modal ── */}
      {openEntry ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-gray-900/30 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${getTypeColor(openEntry.entryType)}`}>
                    {formatEntryType(openEntry.entryType)}
                  </span>
                  <span className="text-xs text-gray-400">{openEntry.entryDate.slice(0, 10)}</span>
                </div>
                <h3 className="mt-2 font-mono text-2xl font-bold text-gray-900">
                  {formatCurrency(openEntry.amount)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenEntryId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </div>

            {/* Details grid */}
            <div className="px-5 py-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Type", value: formatEntryType(openEntry.entryType) },
                  { label: "Person", value: openEntry.personName ?? "Not set" },
                  { label: "Category", value: openEntry.category ?? "Not set" },
                  { label: "Corrections", value: String(openEntry.correctionCount) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Note</p>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                  {openEntry.note ?? openEntry.sourceText ?? "No extra note saved for this entry."}
                </p>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleUndo(openEntry.id)}
                  disabled={isPending || openEntry.correctionCount === 0}
                  className="secondary-button rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                >
                  ↩ Undo last correction
                </button>
              </div>
            </div>

            {/* Correction form */}
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-sm font-semibold text-gray-900">Submit a correction</p>
              <form
                action={(formData) => handleCorrectionSubmit(openEntry.id, formData)}
                className="mt-3 grid gap-3 md:grid-cols-2"
              >
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Updated amount</span>
                  <input name="amount" type="number" step="0.01" className="field mt-1.5 rounded-lg" />
                </label>
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Updated type</span>
                  <select name="entryType" className="field mt-1.5 rounded-lg" defaultValue="">
                    {correctionTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Updated category</span>
                  <input name="category" type="text" className="field mt-1.5 rounded-lg" />
                </label>
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Person</span>
                  <input name="personName" type="text" className="field mt-1.5 rounded-lg" />
                </label>
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Updated date</span>
                  <input name="resolvedDate" type="date" className="field mt-1.5 rounded-lg" />
                </label>
                <label className="text-sm text-gray-600">
                  <span className="font-medium">Reason</span>
                  <input name="reason" type="text" placeholder="Example: amount was incorrect" className="field mt-1.5 rounded-lg" />
                </label>
                <label className="text-sm text-gray-600 md:col-span-2">
                  <span className="font-medium">Note</span>
                  <textarea
                    name="note"
                    className="field mt-1.5 min-h-20 resize-none rounded-lg"
                    defaultValue={openEntry.note ?? ""}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-button rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 md:col-span-2"
                >
                  {isPending ? "Saving correction..." : "Save correction"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
