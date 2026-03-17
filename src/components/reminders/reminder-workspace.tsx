"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useNativeSpeech } from "@/hooks/use-native-speech";
import type { ReminderParseResult } from "@/lib/reminders/reminder-parse-contract";
import type {
  CreateReminderResponse,
  ReminderMutationResponse,
} from "@/lib/reminders/reminder-contract";
import type { ReminderBoard, ReminderItem } from "@/lib/reminders/types";
import { getVoiceReplyContext, voiceText, type VoiceReplyContext } from "@/lib/voice/voice-localization";

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
  const [voiceReplyContext, setVoiceReplyContext] = useState<VoiceReplyContext>({
    mode: "english",
    speechLang: "en-IN",
  });
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

  const buildVoiceReply = (
    result: ReminderParseResult,
    context: VoiceReplyContext,
  ) => {
    if (!result.draft) {
      return result.clarificationQuestion
        ? result.clarificationQuestion
        : voiceText(context, {
            english: "I found the reminder intent, but I still need one more detail.",
            hinglish: "Reminder samajh aa gaya, lekin ek aur detail chahiye.",
            hindi: "रिमाइंडर समझ आ गया, लेकिन एक और जानकारी चाहिए।",
          });
    }

    if (result.draft.assumedTime) {
      return voiceText(context, {
        english: `I prepared the reminder for ${result.draft.dueLabel}. Please review before saving.`,
        hinglish: `${result.draft.dueLabel} ke liye reminder ready hai. Save se pehle review kar lijiye.`,
        hindi: `${result.draft.dueLabel} के लिए रिमाइंडर तैयार है। सेव करने से पहले देख लीजिए।`,
      });
    }

    return voiceText(context, {
      english: `I prepared the reminder for ${result.draft.dueLabel}. Please review and confirm.`,
      hinglish: `${result.draft.dueLabel} ke liye reminder ready hai. Review karke confirm kijiye.`,
      hindi: `${result.draft.dueLabel} के लिए रिमाइंडर तैयार है। देखकर पुष्टि कीजिए।`,
    });
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
          const context = getVoiceReplyContext(inputText);
          setVoiceReplyContext(context);
          const reply = buildVoiceReply(payload, context);
          setVoiceMessage(reply);
          speakText(reply, context.speechLang);
        }
      } catch (caughtError) {
        setNaturalError(
          caughtError instanceof Error
            ? caughtError.message
            : "The reminder could not be understood.",
        );

        if (source === "voice") {
          const context = getVoiceReplyContext(inputText);
          setVoiceReplyContext(context);
          const reply = voiceText(context, {
            english: "I could not prepare the reminder clearly. Please try again.",
            hinglish: "Main reminder clearly prepare nahi kar paya. Ek baar fir se boliye.",
            hindi: "मैं रिमाइंडर साफ़ तरीके से तैयार नहीं कर पाया। कृपया फिर से बोलिए।",
          });
          setVoiceMessage(reply);
          speakText(reply, context.speechLang);
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
  } = useNativeSpeech({
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
        speakText(
          voiceText(voiceReplyContext, {
            english: "Reminder saved successfully.",
            hinglish: "Reminder successfully save ho gaya.",
            hindi: "रिमाइंडर सफलतापूर्वक सेव हो गया।",
          }),
          voiceReplyContext.speechLang,
        );
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
    <section className="space-y-3">
      {/* ── Header + stats ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reminders</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Create, track, and manage your follow-ups.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
            {board.helperText}
          </span>
        </div>

        {error ? (
          <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{error}</p>
        ) : null}

        {success ? (
          <p className="status-positive mt-3 rounded-lg border px-3 py-2 text-sm">{success}</p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="font-mono text-xl font-bold text-gray-900">{board.counts.active}</p>
            <p className="mt-0.5 text-xs text-gray-400">Active</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-center">
            <p className="font-mono text-xl font-bold text-red-700">{board.counts.overdue}</p>
            <p className="mt-0.5 text-xs text-red-400">Overdue</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="font-mono text-xl font-bold text-gray-900">{board.counts.closed}</p>
            <p className="mt-0.5 text-xs text-gray-400">Closed</p>
          </div>
        </div>

        {variant === "page" ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                showCreateForm
                  ? "bg-gray-100 text-gray-700"
                  : "primary-button"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5h-5.5a.75.75 0 010-1.5h5.5v-5.5A.75.75 0 0110 3z" /></svg>
              {showCreateForm ? "Hide form" : "New reminder"}
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Create form ── */}
      {showCreateForm ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Create reminder</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Speak or type naturally, review the preview, then confirm.
              </p>
            </div>
            <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-400">
              Bucket: {defaultBucket}
            </span>
          </div>

          {/* Natural input */}
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">Natural language</p>
            <p className="mt-0.5 text-xs text-gray-400">
              e.g. &quot;Kal shaam 6 baje Raju ko payment follow up yaad dilana&quot;
            </p>

            <textarea
              value={naturalInput}
              onChange={(event) => setNaturalInput(event.target.value)}
              placeholder="Type or speak a reminder naturally"
              className="field mt-3 min-h-24 resize-none rounded-lg"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {reminderSamples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setNaturalInput(sample)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-[#0d9488]"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">🎤 Voice input</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Mic se bolo, app reminder preview bana degi.
                </p>
              </div>
              {isVoiceSupported ? (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isPending || isParsingNatural || isSavingNatural}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 ${
                    isListening ? "bg-red-500" : "primary-button"
                  }`}
                >
                  {isListening ? "⏹ Stop mic" : "🎙 Start mic"}
                </button>
              ) : (
                <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-400">
                  Browser mic not supported
                </span>
              )}
            </div>

            {isListening || liveTranscript ? (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-gray-700">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0d9488]">
                  {isListening ? "● Listening..." : "Captured transcript"}
                </p>
                <p className="mt-1">{liveTranscript || "Start speaking..."}</p>
              </div>
            ) : null}

            {voiceError ? (
              <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{voiceError}</p>
            ) : null}

            {voiceMessage ? (
              <p className="status-positive mt-3 rounded-lg border px-3 py-2 text-sm">{voiceMessage}</p>
            ) : null}

            {naturalError ? (
              <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{naturalError}</p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => runNaturalParse(naturalInput, "text")}
                disabled={
                  isPending ||
                  isParsingNatural ||
                  isSavingNatural ||
                  naturalInput.trim().length < 3
                }
                className="primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
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
                className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingNatural ? "Saving..." : "✓ Confirm reminder"}
              </button>
            </div>

            {parsedReminder ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                    {parsedReminder.parserMode}
                  </span>
                  <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-[#0d9488]">
                    {Math.round(parsedReminder.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{parsedReminder.summaryText}</p>

                {parsedReminder.draft ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: "Title", value: parsedReminder.draft.title },
                      { label: "Due", value: parsedReminder.draft.dueLabel },
                      { label: "Person", value: parsedReminder.draft.linkedPerson ?? "General" },
                      { label: "Time", value: parsedReminder.draft.assumedTime ? "9:00 AM assumed" : "Exact time" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                        <p className="text-[11px] font-medium text-gray-400">{item.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="status-warn mt-3 rounded-lg border px-3 py-2 text-sm">
                    {parsedReminder.clarificationQuestion ??
                      "One more detail is needed before saving."}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Manual form */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-900">Or fill manually</p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-600 sm:col-span-2">
              <span className="font-medium">Reminder title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Follow up with Raju for loan"
                className="field mt-1.5 rounded-lg"
              />
            </label>
            <label className="text-sm text-gray-600 sm:col-span-2">
              <span className="font-medium">Linked person</span>
              <input
                value={linkedPerson}
                onChange={(event) => setLinkedPerson(event.target.value)}
                placeholder="e.g. Raju"
                className="field mt-1.5 rounded-lg"
              />
            </label>
            <label className="text-sm text-gray-600">
              <span className="font-medium">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="field mt-1.5 rounded-lg"
              />
            </label>
            <label className="text-sm text-gray-600">
              <span className="font-medium">Time</span>
              <input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                className="field mt-1.5 rounded-lg"
              />
            </label>
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
            className="primary-button mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isPending ? "Saving..." : "Create reminder"}
          </button>
        </div>
      ) : null}

      {/* ── Dashboard next-due card ── */}
      {variant === "dashboard" && board.nextReminder ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400">Next due</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{board.nextReminder.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatReminderDate(board.nextReminder.effectiveDueAt, timezone)}
              </p>
            </div>
            <Link
              href="/reminders"
              className="secondary-button rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              Open reminders
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Tab bar + lists ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "active"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Active ({board.counts.active})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("closed")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "closed"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Closed ({board.counts.closed})
          </button>
        </div>

        {activeTab === "active" ? (
          <div className="mt-4 space-y-2">
            {visibleActiveReminders.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-gray-400"><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="mt-2 text-sm text-gray-500">No active reminders right now.</p>
              </div>
            ) : (
              visibleActiveReminders.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition-all ${reminderTone(item)}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "OVERDUE"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : item.status === "SNOOZED"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}>
                          {reminderStatusCopy(item)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatReminderDate(item.effectiveDueAt, timezone)}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">{item.title}</h3>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {item.linkedPerson ? `${item.linkedPerson} · ` : ""}
                        {item.bucketSlug ?? "personal"}
                        {item.snoozeUntil
                          ? ` · snoozed from ${formatReminderDate(item.dueAt, timezone)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="time"
                        value={snoozeMap[item.id] ?? "09:00"}
                        onChange={(event) =>
                          setSnoozeMap((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="field min-w-24 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "snooze")}
                        disabled={isPending}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                      >
                        Snooze
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "done")}
                        disabled={isPending}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                      >
                        ✓ Done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReminderAction(item.id, "cancel")}
                        disabled={isPending}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60"
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
          <div className="mt-4 space-y-2">
            {visibleClosedReminders.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">No completed or cancelled reminders yet.</p>
              </div>
            ) : (
              visibleClosedReminders.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                      item.status === "DONE"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-100 text-gray-500"
                    }`}>
                      {reminderStatusCopy(item)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatReminderDate(item.updatedAt, timezone)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {item.linkedPerson
                      ? `Previously linked to ${item.linkedPerson}`
                      : "General reminder"}
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
