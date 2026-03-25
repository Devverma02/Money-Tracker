"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";
import type {
  OpeningLoanDirectionValue,
  SetupResponse,
} from "@/lib/setup/setup-contract";

type FinancialSetupCardProps = {
  setupState: SetupResponse;
  currency: CurrencyCodeValue;
  title?: string;
  description?: string;
};

type OpeningLoanDraft = {
  id: string;
  personName: string;
  direction: OpeningLoanDirectionValue;
  amount: string;
};

function createDraftId() {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

function toLoanDrafts(setupState: SetupResponse): OpeningLoanDraft[] {
  if (setupState.openingLoans.length === 0) {
    return [
      {
        id: "opening-loan-row-1",
        personName: "",
        direction: "RECEIVABLE",
        amount: "",
      },
    ];
  }

  return setupState.openingLoans.map((item) => ({
    id: item.id,
    personName: item.personName,
    direction: item.direction,
    amount: item.amount > 0 ? String(item.amount) : "",
  }));
}

export function FinancialSetupCard({
  setupState,
  currency,
  title = "Starting money position",
  description = "Set your current balance and open loan positions once, so the app starts from your real situation.",
}: FinancialSetupCardProps) {
  const router = useRouter();
  const [openingBalance, setOpeningBalance] = useState(String(setupState.openingBalance || ""));
  const [balanceGuardEnabled, setBalanceGuardEnabled] = useState(
    setupState.balanceGuardEnabled,
  );
  const [loans, setLoans] = useState<OpeningLoanDraft[]>(() => toLoanDrafts(setupState));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOpeningBalance(String(setupState.openingBalance || ""));
    setBalanceGuardEnabled(setupState.balanceGuardEnabled);
    setLoans(toLoanDrafts(setupState));
  }, [setupState]);

  const handleLoanChange = (
    draftId: string,
    field: keyof OpeningLoanDraft,
    value: string,
  ) => {
    setLoans((current) =>
      current.map((loan) =>
        loan.id === draftId ? { ...loan, [field]: value } : loan,
      ),
    );
  };

  const handleAddLoan = () => {
    setLoans((current) => [
      ...current,
      {
        id: createDraftId(),
        personName: "",
        direction: "RECEIVABLE",
        amount: "",
      },
    ]);
  };

  const handleRemoveLoan = (draftId: string) => {
    setLoans((current) => current.filter((loan) => loan.id !== draftId));
  };

  const activeLoans = loans.filter(
    (loan) => loan.personName.trim().length > 0 && Number(loan.amount) > 0,
  );

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch("/api/setup", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            openingBalance: Number(openingBalance || "0"),
            balanceGuardEnabled,
            openingLoans: activeLoans.map((loan) => ({
              personName: loan.personName,
              direction: loan.direction,
              amount: Number(loan.amount),
            })),
            markSetupComplete: true,
          }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "The starting setup could not be saved.");
        }

        setSuccess("Starting money setup saved.");
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The starting setup could not be saved.",
        );
      }
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Current balance
            </label>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              className="field"
              placeholder="5000"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is the real amount of money you currently have available.
            </p>
          </div>

          <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
              Preview
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Starting balance:{" "}
              <span className="font-semibold text-gray-900">
                {formatMoney(Number(openingBalance || "0"), currency)}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Open loan lines:{" "}
              <span className="font-semibold text-gray-900">{activeLoans.length}</span>
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Balance guard</p>
                <p className="mt-1 text-xs text-gray-500">
                  The app will warn you before saving an expense that goes below the tracked balance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceGuardEnabled((current) => !current)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  balanceGuardEnabled
                    ? "bg-[#0d9488] text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                {balanceGuardEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Open loans</p>
              <p className="mt-1 text-xs text-gray-500">
                Add who should pay you and who you still need to pay.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLoan}
              className="secondary-button rounded-lg px-3 py-2 text-xs font-semibold"
            >
              Add row
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {loans.map((loan, index) => (
              <div
                key={loan.id}
                className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-[1.1fr_0.8fr_0.7fr_auto]"
              >
                <input
                  value={loan.personName}
                  onChange={(event) =>
                    handleLoanChange(loan.id, "personName", event.target.value)
                  }
                  className="field"
                  placeholder={`Person ${index + 1}`}
                />
                <select
                  value={loan.direction}
                  onChange={(event) =>
                    handleLoanChange(
                      loan.id,
                      "direction",
                      event.target.value as OpeningLoanDirectionValue,
                    )
                  }
                  className="field"
                >
                  <option value="RECEIVABLE">I should receive</option>
                  <option value="PAYABLE">I should pay</option>
                </select>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={loan.amount}
                  onChange={(event) => handleLoanChange(loan.id, "amount", event.target.value)}
                  className="field"
                  placeholder="Amount"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLoan(loan.id)}
                  disabled={loans.length === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p className="status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{error}</p>
      ) : null}

      {success ? (
        <p className="status-positive mt-4 rounded-lg border px-3 py-2 text-sm">{success}</p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {isPending ? "Saving..." : setupState.hasCompletedSetup ? "Update setup" : "Save setup"}
        </button>
      </div>
    </section>
  );
}
