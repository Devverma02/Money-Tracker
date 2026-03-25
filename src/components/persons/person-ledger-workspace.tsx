"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";

type PersonSummary = {
  personId: string;
  personName: string;
  aliases: string[];
  totalGiven: number;
  totalReceivedBack: number;
  totalTaken: number;
  totalRepaid: number;
  netReceivable: number;
  netPayable: number;
  transactionCount: number;
  lastTransactionDate: string;
};

type PersonTransaction = {
  id: string;
  amount: number;
  entryType: string;
  category: string | null;
  note: string | null;
  entryDate: string;
  sourceText: string | null;
  createdAt: string;
};

type PersonDetail = {
  personId: string;
  personName: string;
  aliases: string[];
  summary: {
    totalGiven: number;
    totalReceivedBack: number;
    totalTaken: number;
    totalRepaid: number;
    otherAmount: number;
    netReceivable: number;
    netPayable: number;
    transactionCount: number;
  };
  transactions: PersonTransaction[];
};

type PersonMergeSuggestion = {
  sourcePersonId: string;
  sourcePersonName: string;
  targetPersonId: string;
  targetPersonName: string;
  reason: string;
};

const typeColorMap: Record<string, string> = {
  EXPENSE: "border-red-200 bg-red-50 text-red-700",
  INCOME: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOAN_GIVEN: "border-orange-200 bg-orange-50 text-orange-700",
  LOAN_TAKEN: "border-amber-200 bg-amber-50 text-amber-700",
  LOAN_RECEIVED_BACK: "border-teal-200 bg-teal-50 text-teal-700",
  LOAN_REPAID: "border-cyan-200 bg-cyan-50 text-cyan-700",
  SAVINGS_DEPOSIT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  NOTE: "border-gray-200 bg-gray-50 text-gray-600",
};

function formatEntryType(entryType: string) {
  return entryType.replaceAll("_", " ").toLowerCase();
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PersonLedgerWorkspace({ currency }: { currency: CurrencyCodeValue }) {
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [mergeSuggestions, setMergeSuggestions] = useState<PersonMergeSuggestion[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [aliasValue, setAliasValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isDetailLoading, startDetailTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();

  const loadPersons = () => {
    startLoadingTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/persons");
        const payload = (await response.json()) as
          | { persons: PersonSummary[]; mergeSuggestions?: PersonMergeSuggestion[] }
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Failed to load people.",
          );
        }

        if ("persons" in payload) {
          setPersons(payload.persons);
          setMergeSuggestions(payload.mergeSuggestions ?? []);
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load people.",
        );
      }
    });
  };

  const loadPersonDetail = (personId: string) => {
    startDetailTransition(async () => {
      try {
        setError(null);
        setSuccess(null);
        const response = await fetch(
          `/api/persons?personId=${encodeURIComponent(personId)}`,
        );
        const payload = (await response.json()) as PersonDetail | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Failed to load person detail.",
          );
        }

        if ("personId" in payload) {
          setSelectedPerson(payload);
          setRenameValue(payload.personName);
          setAliasValue("");
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load person detail.",
        );
      }
    });
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const filteredPersons = useMemo(
    () =>
      persons.filter((person) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return (
          person.personName.toLowerCase().includes(query) ||
          person.aliases.some((alias) => alias.toLowerCase().includes(query))
        );
      }),
    [persons, searchQuery],
  );

  const totalReceivable = persons.reduce((sum, person) => sum + person.netReceivable, 0);
  const totalPayable = persons.reduce((sum, person) => sum + person.netPayable, 0);

  const handleRename = () => {
    if (!selectedPerson || renameValue.trim().length < 1) {
      return;
    }

    startSavingTransition(async () => {
      try {
        setError(null);
        setSuccess(null);

        const response = await fetch("/api/persons", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId: selectedPerson.personId,
            displayName: renameValue.trim(),
          }),
        });
        const payload = (await response.json()) as {
          ok?: true;
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "The person name could not be updated.");
        }

        setSuccess(payload.message ?? "Person name updated.");
        await Promise.all([loadPersonDetail(selectedPerson.personId), loadPersons()]);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The person name could not be updated.",
        );
      }
    });
  };

  const handleAddAlias = () => {
    if (!selectedPerson || aliasValue.trim().length < 1) {
      return;
    }

    startSavingTransition(async () => {
      try {
        setError(null);
        setSuccess(null);

        const response = await fetch("/api/persons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId: selectedPerson.personId,
            alias: aliasValue.trim(),
          }),
        });
        const payload = (await response.json()) as {
          ok?: true;
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "The alias could not be saved.");
        }

        setSuccess(payload.message ?? "Alias saved.");
        setAliasValue("");
        await Promise.all([loadPersonDetail(selectedPerson.personId), loadPersons()]);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The alias could not be saved.",
        );
      }
    });
  };

  const handleMergeSuggestion = (suggestion: PersonMergeSuggestion) => {
    startSavingTransition(async () => {
      try {
        setError(null);
        setSuccess(null);

        const response = await fetch("/api/persons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId: suggestion.targetPersonId,
            alias: suggestion.sourcePersonName,
          }),
        });
        const payload = (await response.json()) as {
          ok?: true;
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "The people could not be merged.");
        }

        setSuccess(payload.message ?? "People merged successfully.");
        if (selectedPerson?.personId === suggestion.sourcePersonId) {
          setSelectedPerson(null);
        }
        await loadPersons();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The people could not be merged.",
        );
      }
    });
  };

  if (selectedPerson) {
    const { summary, transactions } = selectedPerson;

    return (
      <section className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPerson.personName}</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {summary.transactionCount} transactions
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-400">Rename person</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    className="field"
                    placeholder="Person name"
                  />
                  <button
                    type="button"
                    onClick={handleRename}
                    disabled={isSaving || renameValue.trim().length < 1}
                    className="secondary-button rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rename
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-400">Add alias or merge</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={aliasValue}
                    onChange={(event) => setAliasValue(event.target.value)}
                    className="field"
                    placeholder="Alias like Raju bhai"
                  />
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    disabled={isSaving || aliasValue.trim().length < 1}
                    className="secondary-button rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {selectedPerson.aliases.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPerson.aliases.map((alias) => (
                <span
                  key={`${selectedPerson.personId}-${alias}`}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500"
                >
                  {alias}
                </span>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{error}</p>
          ) : null}

          {success ? (
            <p className="status-positive mt-4 rounded-lg border px-3 py-2 text-sm">{success}</p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-orange-400">
                You gave
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-orange-700">
                {formatMoney(summary.totalGiven, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-teal-500">
                Got back
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-teal-700">
                {formatMoney(summary.totalReceivedBack, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-500">
                You took
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-700">
                {formatMoney(summary.totalTaken, currency)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-blue-500">
                You repaid
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-blue-700">
                {formatMoney(summary.totalRepaid, currency)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.netReceivable > 0 ? (
              <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
                <p className="text-xs font-semibold text-orange-600">
                  To receive from {selectedPerson.personName}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-orange-700">
                  {formatMoney(summary.netReceivable, currency)}
                </p>
              </div>
            ) : null}

            {summary.netPayable > 0 ? (
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-600">
                  To pay {selectedPerson.personName}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-amber-700">
                  {formatMoney(summary.netPayable, currency)}
                </p>
              </div>
            ) : null}

            {summary.netReceivable === 0 && summary.netPayable === 0 ? (
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold text-emerald-600">All settled</p>
                <p className="mt-1 text-sm text-emerald-700">
                  No pending balance with {selectedPerson.personName}.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">Transaction history</h3>

          {transactions.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No transactions found.</p>
            </div>
          ) : (
            <div className="relative mt-4">
              <div className="absolute bottom-0 left-[19px] top-0 w-px bg-gray-200" />
              <div className="space-y-3">
                {transactions.map((txn) => {
                  const typeColor =
                    typeColorMap[txn.entryType] ?? "border-gray-200 bg-gray-50 text-gray-600";

                  return (
                    <div key={txn.id} className="relative flex gap-3 pl-10">
                      <div className="absolute left-[15px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-400 shadow-sm" />
                      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${typeColor}`}
                              >
                                {formatEntryType(txn.entryType)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatDate(txn.entryDate)}
                              </span>
                            </div>
                            {txn.category ? (
                              <p className="mt-1 text-xs text-gray-500">{txn.category}</p>
                            ) : null}
                          </div>
                          <p className="font-mono text-lg font-bold text-gray-900">
                            {formatMoney(txn.amount, currency)}
                          </p>
                        </div>
                        {txn.note || txn.sourceText ? (
                          <p className="mt-2 text-xs text-gray-500">
                            {txn.note ?? txn.sourceText}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">People Ledger</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Track who owes what and manage person aliases in one place.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
            {persons.length} people
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-orange-100 bg-orange-50 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-orange-400">
              Total to receive
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-orange-700">
              {formatMoney(totalReceivable, currency)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-500">
              Total to pay
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-amber-700">
              {formatMoney(totalPayable, currency)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Net position
            </p>
            <p
              className={`mt-1 font-mono text-xl font-bold ${
                totalReceivable - totalPayable >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {totalReceivable - totalPayable >= 0 ? "+" : ""}
              {formatMoney(totalReceivable - totalPayable, currency)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name..."
            className="field rounded-lg text-sm"
          />
        </div>

        {error ? (
          <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{error}</p>
        ) : null}

        {success ? (
          <p className="status-positive mt-3 rounded-lg border px-3 py-2 text-sm">{success}</p>
        ) : null}

        {mergeSuggestions.length > 0 ? (
          <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-3">
            <p className="text-sm font-semibold text-gray-900">Possible merges</p>
            <div className="mt-3 space-y-2">
              {mergeSuggestions.slice(0, 4).map((suggestion) => (
                <div
                  key={`${suggestion.sourcePersonId}-${suggestion.targetPersonId}`}
                  className="flex flex-col gap-2 rounded-lg border border-teal-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {suggestion.sourcePersonName} and {suggestion.targetPersonName}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{suggestion.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMergeSuggestion(suggestion)}
                    disabled={isSaving}
                    className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-[#0d9488] transition-colors hover:bg-teal-100 disabled:opacity-60"
                  >
                    Merge into {suggestion.targetPersonName}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm text-gray-500">Loading people...</p>
        </div>
      ) : filteredPersons.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-900">No people found</p>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? "Try a different search."
              : "Save entries with person names to see them here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPersons.map((person) => (
            <button
              key={person.personId}
              type="button"
              onClick={() => loadPersonDetail(person.personId)}
              disabled={isDetailLoading}
              className="group rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-[#0d9488] hover:shadow-md disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 text-sm font-bold text-[#0d9488]">
                      {person.personName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {person.personName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {person.transactionCount} txns
                      </p>
                    </div>
                  </div>

                  {person.aliases.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {person.aliases.slice(0, 3).map((alias) => (
                        <span
                          key={`${person.personId}-${alias}`}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4 text-gray-300 transition-colors group-hover:text-[#0d9488]"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {person.netReceivable > 0 ? (
                  <div className="rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-orange-400">To receive</p>
                    <p className="font-mono text-sm font-bold text-orange-700">
                      {formatMoney(person.netReceivable, currency)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-gray-400">To receive</p>
                    <p className="font-mono text-sm font-bold text-gray-400">
                      {formatMoney(0, currency)}
                    </p>
                  </div>
                )}

                {person.netPayable > 0 ? (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-amber-500">To pay</p>
                    <p className="font-mono text-sm font-bold text-amber-700">
                      {formatMoney(person.netPayable, currency)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-gray-400">To pay</p>
                    <p className="font-mono text-sm font-bold text-gray-400">
                      {formatMoney(0, currency)}
                    </p>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
