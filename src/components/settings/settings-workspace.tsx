"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FinancialSetupCard } from "@/components/setup/financial-setup-card";
import { createClient } from "@/lib/supabase/browser";
import type {
  CurrencyCodeValue,
  EntryInputPreferenceValue,
  PreferredLanguageValue,
  SettingsResponse,
} from "@/lib/settings/settings-contract";
import { currencyOptions } from "@/lib/settings/currency";
import type { SetupResponse } from "@/lib/setup/setup-contract";

type SettingsWorkspaceProps = {
  settings: SettingsResponse;
  setupState: SetupResponse;
};

type CategoryGroup = {
  canonicalName: string;
  aliases: string[];
  entryCount: number;
};

const timezoneOptions = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

export function SettingsWorkspace({ settings, setupState }: SettingsWorkspaceProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguageValue>(
    settings.preferredLanguage,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCodeValue>(
    settings.preferredCurrency,
  );
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(
    settings.voiceRepliesEnabled,
  );
  const [reminderDefaultTime, setReminderDefaultTime] = useState(
    settings.reminderDefaultTime,
  );
  const [preferredEntryInput, setPreferredEntryInput] =
    useState<EntryInputPreferenceValue>(settings.preferredEntryInput);
  const [balanceGuardEnabled, setBalanceGuardEnabled] = useState(
    settings.balanceGuardEnabled,
  );
  const [defaultBucketSlug, setDefaultBucketSlug] = useState(
    settings.defaultBucketSlug,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [sourceCategory, setSourceCategory] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState("");
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [bucketSuccess, setBucketSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCategoryPending, startCategoryTransition] = useTransition();
  const [isBucketPending, startBucketTransition] = useTransition();
  const [isDeletingAccount, startDeleteTransition] = useTransition();

  const loadCategoryGroups = async () => {
    const response = await fetch("/api/categories");
    const payload = (await response.json()) as
      | { groups: CategoryGroup[] }
      | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in payload && payload.error
          ? payload.error
          : "The category list could not be loaded.",
      );
    }

    if ("groups" in payload) {
      setCategoryGroups(payload.groups);
      setSourceCategory((current) =>
        current || !payload.groups[0] ? current : payload.groups[0].canonicalName,
      );
      setTargetCategory((current) =>
        current || !payload.groups[1] ? current : payload.groups[1].canonicalName,
      );
    }
  };

  const timezoneChoices = useMemo(() => {
    if (timezoneOptions.includes(settings.timezone)) {
      return timezoneOptions;
    }

    return [settings.timezone, ...timezoneOptions];
  }, [settings.timezone]);

  useEffect(() => {
    startCategoryTransition(async () => {
      try {
        await loadCategoryGroups();
      } catch {
        setCategoryError("The category list could not be loaded.");
      }
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName,
            preferredLanguage,
            timezone,
            preferredCurrency,
            voiceRepliesEnabled,
            reminderDefaultTime,
            preferredEntryInput,
            balanceGuardEnabled,
            defaultBucketSlug,
          }),
        });

        const payload = (await response.json()) as
          | SettingsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The settings could not be saved.",
          );
        }

        setSuccess("Settings saved successfully.");
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The settings could not be saved.",
        );
      }
    });
  };

  const handleCreateBucket = () => {
    startBucketTransition(async () => {
      setBucketError(null);
      setBucketSuccess(null);

      try {
        const response = await fetch("/api/buckets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newBucketName,
          }),
        });

        const payload = (await response.json()) as
          | { ok: true; message: string }
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The bucket could not be created.",
          );
        }

        if (!("message" in payload)) {
          throw new Error("The bucket could not be created.");
        }

        setBucketSuccess(payload.message);
        setNewBucketName("");
        router.refresh();
      } catch (caughtError) {
        setBucketError(
          caughtError instanceof Error
            ? caughtError.message
            : "The bucket could not be created.",
        );
      }
    });
  };

  const handleMergeCategories = () => {
    startCategoryTransition(async () => {
      setCategoryError(null);
      setCategorySuccess(null);

      try {
        const response = await fetch("/api/categories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceCategory,
            targetCategory,
          }),
        });

        const payload = (await response.json()) as
          | { ok: true; message: string }
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The category merge could not be saved.",
          );
        }

        if (!("message" in payload)) {
          throw new Error("The category merge could not be saved.");
        }

        setCategorySuccess(payload.message);
        await loadCategoryGroups();
        router.refresh();
      } catch (caughtError) {
        setCategoryError(
          caughtError instanceof Error
            ? caughtError.message
            : "The category merge could not be saved.",
        );
      }
    });
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "This will permanently delete your full JebKitab account, all entries, reminders, people, buckets, and settings. This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    startDeleteTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch("/api/settings", {
          method: "DELETE",
        });

        const payload = (await response.json()) as
          | { ok?: boolean; message?: string }
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The account could not be deleted.",
          );
        }

        const supabase = createClient();
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/login");
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The account could not be deleted.",
        );
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500">
            Save your language, voice, and default preferences.
          </p>
        </div>

        {error ? (
          <p className="status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{error}</p>
        ) : null}

        {success ? (
          <p className="status-positive mt-4 rounded-lg border px-3 py-2 text-sm">{success}</p>
        ) : null}
      </div>

      <FinancialSetupCard setupState={setupState} currency={preferredCurrency} />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">General</h3>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Money basics</p>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">Ledger:</span> your full money record. Every entry, income, expense, or loan movement is counted here.
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Bucket:</span> the pocket, account, or use-case the money belongs to, such as personal, home, shop, or a custom bucket.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Display name
              </label>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="field"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Email
              </label>
              <input
                value={settings.email ?? ""}
                disabled
                className="field bg-gray-50 text-gray-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Language
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["HINGLISH", "Hinglish"],
                    ["HINDI", "Hindi"],
                    ["ENGLISH", "English"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setPreferredLanguage(value as PreferredLanguageValue)
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      preferredLanguage === value
                        ? "bg-[#0d9488] text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="field"
              >
                {timezoneChoices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                Currency
              </label>
              <select
                value={preferredCurrency}
                onChange={(event) =>
                  setPreferredCurrency(event.target.value as CurrencyCodeValue)
                }
                className="field"
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.value})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900">Voice</h3>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Voice replies</p>
                <p className="mt-1 text-xs text-gray-500">
                  Let the app speak confirmations and answers aloud.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setVoiceRepliesEnabled((current) => !current)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  voiceRepliesEnabled
                    ? "bg-[#0d9488] text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {voiceRepliesEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900">Defaults</h3>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Balance guard</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Show a warning before saving an expense that goes below the tracked balance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBalanceGuardEnabled((current) => !current)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      balanceGuardEnabled
                        ? "bg-[#0d9488] text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {balanceGuardEnabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Quick entry mode
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["TYPING", "Typing"],
                      ["MIC", "Mic"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setPreferredEntryInput(value as EntryInputPreferenceValue)
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        preferredEntryInput === value
                          ? "bg-[#0d9488] text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Default bucket
                </label>
                <select
                  value={defaultBucketSlug}
                  onChange={(event) => setDefaultBucketSlug(event.target.value)}
                  className="field"
                >
                  {settings.buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.slug}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Reminder default time
                </label>
                <input
                  type="time"
                  value={reminderDefaultTime}
                  onChange={(event) => setReminderDefaultTime(event.target.value)}
                  className="field"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-gray-900">Buckets</h3>
          <p className="text-sm text-gray-500">
            Buckets tell the app where the money belongs. You can create new buckets and choose the default one.
          </p>
        </div>

        {bucketError ? (
          <p className="status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{bucketError}</p>
        ) : null}

        {bucketSuccess ? (
          <p className="status-positive mt-4 rounded-lg border px-3 py-2 text-sm">{bucketSuccess}</p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={newBucketName}
            onChange={(event) => setNewBucketName(event.target.value)}
            className="field"
            placeholder="Add custom bucket like Bank, Shop cash, Side work"
          />
          <button
            type="button"
            onClick={handleCreateBucket}
            disabled={isBucketPending || newBucketName.trim().length < 2}
            className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {isBucketPending ? "Creating..." : "Create bucket"}
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {settings.buckets.map((bucket) => (
            <div
              key={bucket.id}
              className={`rounded-lg border p-3 ${
                bucket.slug === defaultBucketSlug
                  ? "border-teal-200 bg-teal-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{bucket.name}</p>
                {bucket.slug === defaultBucketSlug ? (
                  <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0d9488]">
                    Default
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-500">{bucket.slug}</p>
              <p className="mt-2 text-xs text-gray-400">{bucket.kind.toLowerCase()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-gray-900">Category merges</h3>
          <p className="text-sm text-gray-500">
            Combine similar categories like home items, home accessories, and ghar ka saman.
          </p>
        </div>

        {categoryError ? (
          <p className="status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{categoryError}</p>
        ) : null}

        {categorySuccess ? (
          <p className="status-positive mt-4 rounded-lg border px-3 py-2 text-sm">{categorySuccess}</p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">From</label>
            <select
              value={sourceCategory}
              onChange={(event) => setSourceCategory(event.target.value)}
              className="field"
            >
              {categoryGroups.map((group) => (
                <option key={`source-${group.canonicalName}`} value={group.canonicalName}>
                  {group.canonicalName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">Into</label>
            <select
              value={targetCategory}
              onChange={(event) => setTargetCategory(event.target.value)}
              className="field"
            >
              {categoryGroups.map((group) => (
                <option key={`target-${group.canonicalName}`} value={group.canonicalName}>
                  {group.canonicalName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleMergeCategories}
              disabled={
                isCategoryPending ||
                !sourceCategory ||
                !targetCategory ||
                sourceCategory === targetCategory
              }
              className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCategoryPending ? "Merging..." : "Merge"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {categoryGroups.slice(0, 8).map((group) => (
            <div key={group.canonicalName} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{group.canonicalName}</p>
              <p className="mt-1 text-xs text-gray-500">{group.entryCount} entries</p>
              {group.aliases.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.aliases.map((alias) => (
                    <span
                      key={`${group.canonicalName}-${alias}`}
                      className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4 lg:max-w-xl">
            <h3 className="text-sm font-semibold text-red-700">Delete all data</h3>
            <p className="mt-1 text-sm text-red-600">
              Permanently remove your full account, entries, reminders, people,
              buckets, settings, and saved history. You will be signed out right
              away.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeletingAccount ? "Deleting..." : "Delete account and all data"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || displayName.trim().length < 1 || isDeletingAccount}
            className="primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </section>
  );
}
