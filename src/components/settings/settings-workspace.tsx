"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  EntryInputPreferenceValue,
  PreferredLanguageValue,
  SettingsResponse,
} from "@/lib/settings/settings-contract";

type SettingsWorkspaceProps = {
  settings: SettingsResponse;
};

const timezoneOptions = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

export function SettingsWorkspace({ settings }: SettingsWorkspaceProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguageValue>(
    settings.preferredLanguage,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(
    settings.voiceRepliesEnabled,
  );
  const [reminderDefaultTime, setReminderDefaultTime] = useState(
    settings.reminderDefaultTime,
  );
  const [preferredEntryInput, setPreferredEntryInput] =
    useState<EntryInputPreferenceValue>(settings.preferredEntryInput);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timezoneChoices = useMemo(() => {
    if (timezoneOptions.includes(settings.timezone)) {
      return timezoneOptions;
    }

    return [settings.timezone, ...timezoneOptions];
  }, [settings.timezone]);

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
            voiceRepliesEnabled,
            reminderDefaultTime,
            preferredEntryInput,
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

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">General</h3>

          <div className="mt-4 space-y-4">
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

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || displayName.trim().length < 1}
            className="primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </section>
  );
}
