"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useBrowserVoice } from "@/hooks/use-browser-voice";
import type { ReminderParseResult } from "@/lib/reminders/reminder-parse-contract";
import type {
  CreateReminderResponse,
  ReminderMutationResponse,
} from "@/lib/reminders/reminder-contract";
import type { ReminderBoard, ReminderItem } from "@/lib/reminders/types";

const reminderSamples = [
  "Kal shaam 6 baje Raju ko loan follow up yaad dilana",
  "Next Monday electricity bill bharna yaad dilana",
  "Parso subah mummy ko 5000 dene ka reminder lagao",
];

type ReminderWorkspaceProps = {
  board: ReminderBoard;
  timezone: string;
  defaultBucket: string;
  variant?: "dashboard" | "page";
};

function formatReminderDate(isoString: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(isoString));
}

function formatDateInputValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function buildLocalDate(daysAhead = 0) {
  const base = new Date();
  base.setDate(base.getDate() + daysAhead);

  return formatDateInputValue(base);
}

function combineLocalDateTime(dateValue: string, timeValue?: string) {
  const resolved = new Date(`${dateValue}T${timeValue || "09:00"}`);
  return resolved.toISOString();
}

function reminderTone(item: ReminderItem) {
  if (item.status === "OVERDUE") {
    return "border-red-200 bg-red-50";
  }

  if (item.status === "SNOOZED") {
    return "border-amber-200 bg-amber-50";
  }

  return "border-white/70 bg-white/75";
}

function reminderStatusCopy(item: ReminderItem) {
  if (item.status === "OVERDUE") {
    return "Overdue";
  }

  if (item.status === "SNOOZED") {
    return "Snoozed";
  }

  if (item.status === "DONE") {
    return "Done";
  }

  if (item.status === "CANCELLED") {
    return "Cancelled";
  }

  return "Pending";
}

export function ReminderWorkspace({
  board,
  timezone,
  defaultBucket,
  variant = "page",
}: ReminderWorkspaceProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [linkedPerson, setLinkedPerson] = useState("");
  const [dueDate, setDueDate] = useState(buildLocalDate());
  const [dueTime, setDueTime] = useState("");
  const [snoozeMap, setSnoozeMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [naturalInput, setNaturalInput] = useState("");
  const [parsedReminder, setParsedReminder] = useState<ReminderParseResult | null>(null);
  const [naturalError, setNaturalError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isParsingNatural, startParseTransition] = useTransition();
  const [isSavingNatural, startNaturalSaveTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(variant !== "dashboard");
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");

  const visibleActiveReminders = useMemo(
    () =>
      variant === "dashboard"
        ? board.activeReminders.slice(0, 4)
        : board.activeReminders,
    [board.activeReminders, variant],
  );
  const visibleClosedReminders = useMemo(
    () =>
      variant === "dashboard"
        ? board.closedReminders.slice(0, 3)
        : board.closedReminders,
    [board.closedReminders, variant],
  );

  const buildVoiceReply = (result: ReminderParseResult) => {
    if (!result.draft) {
      return (
        result.clarificationQuestion ??
        "I found the reminder intent, but I still need one more detail."
      );
    }

    if (result.draft.assumedTime) {
      return `I prepared the reminder for ${result.draft.dueLabel}. Please review before saving.`;
    }

    return `I prepared the reminder for ${result.draft.dueLabel}. Please review and confirm.`;
  };

  const runNaturalParse = (inputText: string, source: "text" | "voice") => {
    startParseTransition(async () => {
      setNaturalError(null);
      setVoiceMessage(null);
      setParsedReminder(null);

      try {
        const response = await fetch("/api/reminders/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputText,
            timezone,
            bucket: defaultBucket,
          }),
        });

        const payload = (await response.json()) as ReminderParseResult | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The reminder could not be understood.",
          );
        }

        if (!("summaryText" in payload)) {
          throw new Error("The reminder parse response was invalid.");
        }

        setParsedReminder(payload);

        if (source === "voice") {
          const reply = buildVoiceReply(payload);
          setVoiceMessage(reply);
          speakText(reply, "en-IN");
        }
      } catch (caughtError) {
        setNaturalError(
          caughtError instanceof Error
            ? caughtError.message
            : "The reminder could not be understood.",
        );

        if (source === "voice") {
          const reply = "I could not prepare the reminder clearly. Please try again.";
          setVoiceMessage(reply);
          speakText(reply, "en-IN");
        }
      }
    });
  };

  const {
    isSupported: isVoiceSupported,
    isListening,
    liveTranscript,
    error: voiceError,
    startListening,
    stopListening,
    speakText,
  } = useBrowserVoice({
    locale: "hi-IN",
    onFinalTranscript: async (transcript) => {
      setNaturalInput(transcript);
      runNaturalParse(transcript, "voice");
    },
  });

  const handleCreateReminder = () => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch("/api/reminders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            linkedPerson: linkedPerson || undefined,
            dueAt: combineLocalDateTime(dueDate, dueTime),
            bucket: defaultBucket,
          }),
        });

        const payload = (await response.json()) as
          | CreateReminderResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The reminder could not be saved.",
          );
        }

        if (!("message" in payload)) {
          throw new Error("The reminder response was invalid.");
        }

        setTitle("");
        setLinkedPerson("");
        setDueDate(buildLocalDate());
        setDueTime("");
        setSuccess(payload.message);
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The reminder could not be saved.",
        );
      }
    });
  };

  const handleSaveParsedReminder = () => {
    const draft = parsedReminder?.draft;

    if (!draft) {
      return;
    }

    startNaturalSaveTransition(async () => {
      setError(null);
      setSuccess(null);
      setNaturalError(null);

      try {
        const response = await fetch("/api/reminders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draft.title,
            linkedPerson: draft.linkedPerson ?? undefined,
            dueAt: draft.dueAt,
            bucket: draft.bucket,
          }),
        });

        const payload = (await response.json()) as
          | CreateReminderResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The reminder could not be saved.",
          );
        }

        if (!("message" in payload)) {
          throw new Error("The reminder response was invalid.");
        }

        setNaturalInput("");
        setParsedReminder(null);
        setVoiceMessage(null);
        setSuccess(payload.message);
        speakText("Reminder saved successfully.", "en-IN");
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The reminder could not be saved.",
        );
      }
    });
  };

  const handleReminderAction = (
    reminderId: string,
    path: "done" | "cancel" | "snooze",
  ) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`/api/reminders/${reminderId}/${path}`, {
          method: "POST",
          headers:
            path === "snooze"
              ? {
                  "Content-Type": "application/json",
                }
              : undefined,
          body:
            path === "snooze"
              ? JSON.stringify({
                  snoozeUntil: combineLocalDateTime(
                    buildLocalDate(1),
                    snoozeMap[reminderId] || "09:00",
                  ),
                })
              : undefined,
        });

        const payload = (await response.json()) as
          | ReminderMutationResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The reminder could not be updated.",
          );
        }

        if (!("message" in payload)) {
          throw new Error("The reminder response was invalid.");
        }

        setSuccess(payload.message);
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The reminder could not be updated.",
        );
      }
    });
  };

  return (
    <section className="grid gap-5">
      <div className="shell-card rounded-[1rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-brand">Reminders</p>
            <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950 sm:text-4xl">
              Reminders
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Keep this page focused on create, due items, and closed reminders.
            </p>
          </div>
          <div className="rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
            {board.helperText}
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

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="soft-card rounded-[0.9rem] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
              {board.counts.active}
            </p>
          </div>
          <div className="soft-card rounded-[0.9rem] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Overdue
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
              {board.counts.overdue}
            </p>
          </div>
          <div className="soft-card rounded-[0.9rem] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Closed
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
              {board.counts.closed}
            </p>
          </div>
        </div>

        {variant === "page" ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {showCreateForm ? "Hide create reminder" : "Show create reminder"}
            </button>
          </div>
        ) : null}

        {showCreateForm ? (
          <div className="soft-card mt-4 rounded-[1rem] p-5 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Create reminder
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Speak or type naturally, review the preview, then confirm to save.
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bucket: {defaultBucket}
              </span>
            </div>

            <div className="mt-5 rounded-[0.95rem] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Natural reminder</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Example: Kal shaam 6 baje Raju ko payment follow up yaad dilana.
              </p>

              <textarea
                value={naturalInput}
                onChange={(event) => setNaturalInput(event.target.value)}
                placeholder="Type or speak a reminder naturally"
                className="field mt-4 min-h-28 resize-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {reminderSamples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setNaturalInput(sample)}
                    className="secondary-button rounded-full px-4 py-2 text-xs font-semibold"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voice input</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Mic se bolo, app reminder preview bana degi.
                  </p>
                </div>
                {isVoiceSupported ? (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isPending || isParsingNatural || isSavingNatural}
                    className={`rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 ${
                      isListening ? "bg-emerald-700" : "primary-button"
                    }`}
                  >
                    {isListening ? "Stop mic" : "Start mic"}
                  </button>
                ) : (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Browser mic not supported
                  </span>
                )}
              </div>

              {isListening || liveTranscript ? (
                <div className="mt-4 rounded-[0.95rem] bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    {isListening ? "Listening live" : "Captured transcript"}
                  </p>
                  <p className="mt-2">{liveTranscript || "Start speaking..."}</p>
                </div>
              ) : null}

              {voiceError ? (
                <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
                  {voiceError}
                </p>
              ) : null}

              {voiceMessage ? (
                <p className="status-positive mt-4 rounded-2xl border px-4 py-3 text-sm">
                  {voiceMessage}
                </p>
              ) : null}

              {naturalError ? (
                <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
                  {naturalError}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runNaturalParse(naturalInput, "text")}
                  disabled={
                    isPending ||
                    isParsingNatural ||
                    isSavingNatural ||
                    naturalInput.trim().length < 3
                  }
                  className="primary-button rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isParsingNatural ? "Preparing..." : "Generate preview"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveParsedReminder}
                  disabled={
                    isPending ||
                    isParsingNatural ||
                    isSavingNatural ||
                    !parsedReminder?.draft
                  }
                  className="secondary-button rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingNatural ? "Saving..." : "Confirm reminder"}
                </button>
              </div>

              {parsedReminder ? (
                <div className="mt-4 rounded-[0.95rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="rounded-lg bg-white px-3 py-1">
                      {parsedReminder.parserMode}
                    </span>
                    <span className="rounded-lg bg-white px-3 py-1">
                      {Math.round(parsedReminder.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {parsedReminder.summaryText}
                  </p>

                  {parsedReminder.draft ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[0.85rem] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Reminder title
                        </p>
                        <p className="mt-2 font-semibold text-slate-950">
                          {parsedReminder.draft.title}
                        </p>
                      </div>
                      <div className="rounded-[0.85rem] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Due
                        </p>
                        <p className="mt-2 font-semibold text-slate-950">
                          {parsedReminder.draft.dueLabel}
                        </p>
                      </div>
                      <div className="rounded-[0.85rem] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Linked person
                        </p>
                        <p className="mt-2 font-semibold text-slate-950">
                          {parsedReminder.draft.linkedPerson ?? "General reminder"}
                        </p>
                      </div>
                      <div className="rounded-[0.85rem] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Save rule
                        </p>
                        <p className="mt-2 font-semibold text-slate-950">
                          {parsedReminder.draft.assumedTime
                            ? "9:00 am assumed"
                            : "Exact time captured"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="status-warn mt-4 rounded-2xl border px-4 py-3 text-sm">
                      {parsedReminder.clarificationQuestion ??
                        "One more detail is needed before the reminder can be saved."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-sm font-semibold text-slate-900">Or fill manually</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use the classic form if you want to set each field yourself.
              </p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reminder title
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Follow up with Raju for loan repayment"
              className="field mt-2"
            />

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Linked person
            </label>
            <input
              value={linkedPerson}
              onChange={(event) => setLinkedPerson(event.target.value)}
              placeholder="Example: Raju"
              className="field mt-2"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="field mt-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Time
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                  className="field mt-2"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateReminder}
              disabled={
                isPending ||
                isParsingNatural ||
                isSavingNatural ||
                title.trim().length < 3 ||
                dueDate.length < 10
              }
              className="primary-button mt-5 rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Saving..." : "Create reminder"}
            </button>
          </div>
        ) : null}
      </div>

      {variant === "dashboard" && board.nextReminder ? (
        <div className="soft-card rounded-[1rem] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Next due
              </p>
              <p className="mt-2 font-semibold text-slate-950">{board.nextReminder.title}</p>
              <p className="mt-1 text-sm text-slate-600">
                {formatReminderDate(board.nextReminder.effectiveDueAt, timezone)}
              </p>
            </div>
            <Link
              href="/reminders"
              className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Open reminders
            </Link>
          </div>
        </div>
      ) : null}

      <div className="soft-card rounded-[1rem] p-4 sm:p-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === "active"
                ? "bg-slate-950 text-white"
                : "secondary-button"
            }`}
          >
            Active reminders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("closed")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === "closed"
                ? "bg-slate-950 text-white"
                : "secondary-button"
            }`}
          >
            Closed reminders
          </button>
        </div>

        {activeTab === "active" ? (
          <div className="mt-5 space-y-3">
            {visibleActiveReminders.length === 0 ? (
              <p className="text-sm leading-7 text-slate-600">
                There are no active reminders right now.
              </p>
            ) : (
              visibleActiveReminders.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[0.9rem] border px-4 py-4 ${reminderTone(item)}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <span className="rounded-lg bg-white px-3 py-1">
                          {reminderStatusCopy(item)}
                        </span>
                        <span className="rounded-lg bg-white px-3 py-1">
                          {formatReminderDate(item.effectiveDueAt, timezone)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {item.linkedPerson ? `${item.linkedPerson} | ` : ""}
                        {item.bucketSlug ?? "personal"} bucket
                        {item.snoozeUntil
                          ? ` | snoozed from ${formatReminderDate(item.dueAt, timezone)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <input
                        type="time"
                        value={snoozeMap[item.id] ?? "09:00"}
                        onChange={(event) =>
                          setSnoozeMap((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="field min-w-28 !rounded-lg !px-4 !py-2 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "snooze")}
                        disabled={isPending}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
                      >
                        Snooze
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "done")}
                        disabled={isPending}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "cancel")}
                        disabled={isPending}
                        className="secondary-button rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visibleClosedReminders.length === 0 ? (
              <p className="text-sm leading-7 text-slate-600">
                No reminders have been completed or cancelled yet.
              </p>
            ) : (
              visibleClosedReminders.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[0.9rem] border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="rounded-lg bg-slate-100 px-3 py-1">
                      {reminderStatusCopy(item)}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-3 py-1">
                      {formatReminderDate(item.updatedAt, timezone)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {item.linkedPerson
                      ? `Previously linked to ${item.linkedPerson}.`
                      : "General reminder."}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
