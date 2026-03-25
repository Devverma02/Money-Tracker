"use client";

import { useMemo, useState } from "react";
import type { ParsedAction } from "@/lib/ai/parse-contract";
import { allowedEntryTypes } from "@/lib/ai/parse-contract";
import type { PersonConflict } from "@/lib/ledger/save-contract";
import { formatMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";

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

function getMissingInfo(action: ParsedAction) {
  const missing: Array<{
    key: string;
    label: string;
    help: string;
  }> = [];

  if (action.amount === null && action.entryType !== "note") {
    missing.push({
      key: "amount",
      label: "Amount missing",
      help: "Add the amount so this entry can be saved.",
    });
  }

  if (!action.entryType) {
    missing.push({
      key: "type",
      label: "Type missing",
      help: "Choose whether this is an expense, income, or loan entry.",
    });
  }

  if (!action.resolvedDate) {
    missing.push({
      key: "date",
      label: "Date missing",
      help: "Add the date, for example today, yesterday, or 25 March.",
    });
  }

  return missing;
}

type PersonResolution =
  | {
      mode: "existing";
      personId: string;
    }
  | {
      mode: "create";
      label: string;
    };

type ParsePreviewCardProps = {
  action: ParsedAction;
  index: number;
  currency: CurrencyCodeValue;
  isReadyToSave?: boolean;
  isSelected?: boolean;
  canSelect?: boolean;
  personConflict?: PersonConflict | null;
  onToggleSelect?: () => void;
  onActionUpdate?: (index: number, updated: ParsedAction) => void;
  onResolvePersonConflict?: (index: number, resolution: PersonResolution) => void;
};

export function ParsePreviewCard({
  action,
  index,
  currency,
  isReadyToSave = false,
  isSelected = false,
  canSelect = false,
  personConflict = null,
  onToggleSelect,
  onActionUpdate,
  onResolvePersonConflict,
}: ParsePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(
    action.amount !== null ? String(action.amount) : "",
  );
  const [editEntryType, setEditEntryType] = useState(action.entryType ?? "");
  const [editCategory, setEditCategory] = useState(action.category ?? "");
  const [editPersonName, setEditPersonName] = useState(action.personName ?? "");
  const [editDate, setEditDate] = useState(action.resolvedDate ?? "");
  const [newPersonLabel, setNewPersonLabel] = useState(action.personName ?? "");

  const typeKey = action.entryType ?? "note";
  const typeColor = entryTypeColors[typeKey] ?? entryTypeColors.note;
  const hasSelectedResolution = Boolean(action.resolvedPersonId || action.createPersonLabel);
  const missingInfo = useMemo(() => getMissingInfo(action), [action]);

  const resolvedLabel = useMemo(() => {
    if (!personConflict) {
      return null;
    }

    const existingCandidate = action.resolvedPersonId
      ? personConflict.candidates.find((candidate) => candidate.id === action.resolvedPersonId)
      : null;

    if (existingCandidate) {
      return existingCandidate.displayName;
    }

    return action.createPersonLabel?.trim() || null;
  }, [action.createPersonLabel, action.resolvedPersonId, personConflict]);

  const handleStartEdit = () => {
    setEditAmount(action.amount !== null ? String(action.amount) : "");
    setEditEntryType(action.entryType ?? "");
    setEditCategory(action.category ?? "");
    setEditPersonName(action.personName ?? "");
    setEditDate(action.resolvedDate ?? "");
    setNewPersonLabel(action.personName ?? "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!onActionUpdate) {
      return;
    }

    const updatedAction: ParsedAction = {
      ...action,
      amount: editAmount.trim() ? Number(editAmount) : null,
      entryType:
        editEntryType &&
        allowedEntryTypes.includes(editEntryType as (typeof allowedEntryTypes)[number])
          ? (editEntryType as ParsedAction["entryType"])
          : null,
      category: editCategory.trim() || null,
      personName: editPersonName.trim() || null,
      resolvedDate: editDate.trim() || null,
      resolvedPersonId: null,
      createPersonLabel: null,
    };

    onActionUpdate(index, updatedAction);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleChooseExistingPerson = (personId: string) => {
    if (!onResolvePersonConflict) {
      return;
    }

    onResolvePersonConflict(index, {
      mode: "existing",
      personId,
    });
  };

  const handleCreateNewPerson = () => {
    if (!onResolvePersonConflict) {
      return;
    }

    const trimmedLabel = newPersonLabel.trim();
    if (!trimmedLabel) {
      return;
    }

    onResolvePersonConflict(index, {
      mode: "create",
      label: trimmedLabel,
    });
  };

  if (isEditing) {
    return (
      <article className="rounded-xl border-2 border-[#0d9488] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-[#0d9488]">
              Editing
            </span>
            <span className="text-xs text-gray-400">Entry {index + 1}</span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="primary-button rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="secondary-button rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="text-[11px] font-medium text-gray-400">Amount (Rs)</span>
            <input
              type="number"
              step="0.01"
              value={editAmount}
              onChange={(event) => setEditAmount(event.target.value)}
              placeholder="e.g. 500"
              className="field mt-1 rounded-lg text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="text-[11px] font-medium text-gray-400">Type</span>
            <select
              value={editEntryType}
              onChange={(event) => setEditEntryType(event.target.value)}
              className="field mt-1 rounded-lg text-sm"
            >
              <option value="">Select type</option>
              {allowedEntryTypes.map((type) => (
                <option key={type} value={type}>
                  {entryTypeLabels[type] ?? type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-[11px] font-medium text-gray-400">Category</span>
            <input
              type="text"
              value={editCategory}
              onChange={(event) => setEditCategory(event.target.value)}
              placeholder="e.g. food, travel"
              className="field mt-1 rounded-lg text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="text-[11px] font-medium text-gray-400">Person</span>
            <input
              type="text"
              value={editPersonName}
              onChange={(event) => setEditPersonName(event.target.value)}
              placeholder="e.g. Raju"
              className="field mt-1 rounded-lg text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="text-[11px] font-medium text-gray-400">Date</span>
            <input
              type="date"
              value={editDate}
              onChange={(event) => setEditDate(event.target.value)}
              className="field mt-1 rounded-lg text-sm"
            />
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">Source:</span> {action.sourceText}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`rounded-xl border bg-white p-4 transition-all ${
        isSelected ? "border-[#0d9488] ring-1 ring-[#0d9488]/20" : "border-gray-200"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${typeColor}`}
          >
            {action.entryType ? entryTypeLabels[action.entryType] : "Unclear"}
          </span>
          <span className="text-xs text-gray-400">Entry {index + 1}</span>
        </div>

        <div className="flex items-center gap-2">
          <p className="font-mono text-xl font-bold text-gray-900">
            {action.amount !== null ? formatMoney(action.amount, currency) : "--"}
          </p>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
              isReadyToSave
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isReadyToSave ? "Ready" : "Needs info"}
          </span>

          {onActionUpdate ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-[#0d9488] hover:bg-teal-50 hover:text-[#0d9488]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Edit
            </button>
          ) : null}

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
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {item.label}
            </p>
            <p className="mt-1 font-medium text-gray-900">{item.value || "--"}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">Source:</span> {action.sourceText}
      </div>

      {!isReadyToSave && missingInfo.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Still needed to save</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingInfo.map((item) => (
              <span
                key={item.key}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800"
              >
                {item.label}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {missingInfo.map((item) => (
              <p key={`${item.key}-help`} className="text-xs text-amber-900">
                <span className="font-medium">{item.label}:</span> {item.help}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {personConflict ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            Same name matched multiple people
          </p>
          <p className="mt-1 text-sm text-amber-800">
            &quot;{personConflict.inputName}&quot; ke liye sahi person choose kijiye. Agar ye naya person
            hai, to alag label bana dijiye.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {personConflict.candidates.map((candidate) => {
              const isActive = action.resolvedPersonId === candidate.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleChooseExistingPerson(candidate.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[#0d9488] bg-teal-100 text-[#0d9488]"
                      : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                  }`}
                >
                  {candidate.displayName}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newPersonLabel}
              onChange={(event) => setNewPersonLabel(event.target.value)}
              placeholder="Create a new label, e.g. Yash milk"
              className="field flex-1 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={handleCreateNewPerson}
              className="secondary-button rounded-lg px-3 py-2 text-sm font-semibold"
            >
              Create new person
            </button>
          </div>

          {resolvedLabel ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Selected: {resolvedLabel}
            </p>
          ) : hasSelectedResolution ? null : (
            <p className="mt-2 text-xs font-medium text-amber-800">
              Save karne se pehle ek person choose karna zaruri hai.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}
