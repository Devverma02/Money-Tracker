"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ParsePreviewCard } from "@/components/entry/parse-preview-card";
import { RealtimeVoicePanel } from "@/components/entry/realtime-voice-panel";
import { useBrowserVoice } from "@/hooks/use-browser-voice";
import type { ParseResult, ParsedAction } from "@/lib/ai/parse-contract";
import type { SaveEntryResponse } from "@/lib/ledger/save-contract";

const sampleInputs = [
  "Spent 480 on groceries today",
  "Gave Raju 2000 as a loan yesterday",
  "Received salary income of 15000",
  "Aaj 480 grocery aur 200 petrol, kal Raju ko 1000 udhaar diya",
];

type TextEntryWorkspaceProps = {
  timezone: string;
  defaultBucket: string;
};

function isActionReady(action: ParsedAction) {
  return Boolean(
    action.entryType &&
      action.resolvedDate &&
      (action.amount !== null || action.entryType === "note"),
  );
}

function getReadyActionIndexes(result: ParseResult | null) {
  if (!result) {
    return [];
  }

  return result.actions.flatMap((action, index) => (isActionReady(action) ? [index] : []));
}

function buildResultSummary(actions: ParsedAction[]) {
  const readyCount = actions.filter(isActionReady).length;
  const blockedCount = actions.length - readyCount;

  if (actions.length === 0) {
    return {
      needsClarification: false,
      clarificationQuestion: null,
      summaryText: "No preview is left to review.",
    };
  }

  if (blockedCount === 0) {
    return {
      needsClarification: false,
      clarificationQuestion: null,
      summaryText:
        actions.length === 1
          ? "One entry is ready to review and save."
          : `${actions.length} entries are ready to review and save.`,
    };
  }

  return {
    needsClarification: true,
    clarificationQuestion:
      blockedCount === 1
        ? "One remaining item still needs clarification before it can be saved."
        : `${blockedCount} remaining items still need clarification before they can be saved.`,
    summaryText:
      readyCount === 0
        ? "The current preview still needs clarification before anything can be saved."
        : `${readyCount} items are ready. ${blockedCount} still need clarification.`,
  };
}

export function TextEntryWorkspace({
  timezone,
  defaultBucket,
}: TextEntryWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [lastInputMode, setLastInputMode] = useState<"text" | "voice" | null>(null);
  const [isParsing, startParseTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  useEffect(() => {
    setSelectedIndexes(getReadyActionIndexes(result));
  }, [result]);

  const readyIndexes = useMemo(() => getReadyActionIndexes(result), [result]);
  const readyCount = readyIndexes.length;
  const selectedReadyIndexes = selectedIndexes.filter((index) =>
    readyIndexes.includes(index),
  );
  const selectedActions =
    result?.actions.filter((_, index) => selectedReadyIndexes.includes(index)) ?? [];
  const blockedCount = result ? result.actions.length - readyCount : 0;
  const canSave = selectedActions.length > 0 && !isParsing && !isSaving;

  const buildVoiceReply = (parseResult: ParseResult) => {
    const readyItems = parseResult.actions.filter(isActionReady).length;
    const blockedItems = parseResult.actions.length - readyItems;

    if (parseResult.actions.length === 0) {
      return "I heard you. Please try again with a money update.";
    }

    if (blockedItems > 0 && readyItems === 0) {
      return (
        parseResult.clarificationQuestion ??
        "I found the update, but it still needs one more detail before saving."
      );
    }

    if (parseResult.actions.length === 1) {
      const firstAction = parseResult.actions[0];
      const actionLabelMap: Record<string, string> = {
        expense: "an expense",
        income: "an income entry",
        loan_given: "a loan given",
        loan_taken: "a borrowed amount",
        loan_received_back: "a loan received back",
        loan_repaid: "a loan repayment",
        savings_deposit: "a savings deposit",
        note: "a note",
      };
      const actionLabel = firstAction?.entryType
        ? actionLabelMap[firstAction.entryType]
        : "an entry";
      const amountText =
        firstAction?.amount !== null && firstAction?.amount !== undefined
          ? ` for rupees ${firstAction.amount}`
          : "";

      return `I heard ${actionLabel}${amountText}. Please review and confirm to save.`;
    }

    if (blockedItems === 0) {
      return `I found ${parseResult.actions.length} entries. They are ready for your review and save.`;
    }

    return `I found ${parseResult.actions.length} entries. ${readyItems} are ready, and ${blockedItems} still need clarification.`;
  };

  const runParse = (nextInputText: string, source: "text" | "voice") => {
    startParseTransition(async () => {
      setError(null);
      setSaveMessage(null);
      setDuplicateMessage(null);
      setVoiceMessage(null);
      setLastInputMode(source);

      try {
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputText: nextInputText,
            timezone,
            allowedBuckets: [defaultBucket],
          }),
        });

        if (!response.ok) {
          throw new Error("The parser could not review this input right now.");
        }

        const payload = (await response.json()) as ParseResult;
        setResult(payload);

        if (source === "voice") {
          const reply = buildVoiceReply(payload);
          setVoiceMessage(reply);
          speakText(reply, "en-IN");
        }
      } catch {
        setResult(null);
        setError("The parser is unavailable right now. Please try again.");

        if (source === "voice") {
          const reply = "I could not catch that clearly. Please try speaking once more.";
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
      setInputText(transcript);
      runParse(transcript, "voice");
    },
  });

  const handleParse = () => {
    runParse(inputText, "text");
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((left, right) => left - right),
    );
  };

  const handleSave = () => {
    if (!result || !canSave) {
      return;
    }

    startSaveTransition(async () => {
      setError(null);
      setSaveMessage(null);
      setDuplicateMessage(null);

      try {
        const response = await fetch("/api/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actions: selectedActions,
            parserConfidence: result.confidence,
            confirmSave: true,
          }),
        });

        const payload = (await response.json()) as SaveEntryResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "The selected entries could not be saved.",
          );
        }

        if (!("message" in payload) || !("savedEntries" in payload)) {
          throw new Error("The save response was invalid.");
        }

        setSaveMessage(payload.message);
        setDuplicateMessage(
          payload.duplicateWarningCount > 0
            ? `${payload.duplicateWarningCount} saved item(s) look similar to recent history. Please review History.`
            : null,
        );

        if (lastInputMode === "voice") {
          speakText(
            payload.savedCount === 1 ? "Saved successfully." : "Entries saved successfully.",
            "en-IN",
          );
        }

        const remainingActions = result.actions.filter(
          (_, index) => !selectedReadyIndexes.includes(index),
        );

        if (remainingActions.length === 0) {
          setInputText("");
          setResult(null);
          return;
        }

        const nextSummary = buildResultSummary(remainingActions);
        setResult({
          ...result,
          actions: remainingActions,
          ...nextSummary,
        });
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The selected entries could not be saved.",
        );
      }
    });
  };

  const saveButtonLabel =
    selectedActions.length <= 1
      ? "Confirm and save"
      : `Save selected (${selectedActions.length})`;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="shell-card rounded-[1rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brand">Quick entry</p>
            <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950 sm:text-4xl">
              Add money updates
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Write or speak naturally. The app will split multiple updates into separate
              previews before anything is saved.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
            Bucket: {defaultBucket}
          </div>
        </div>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Money update
        </label>
        <textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Example: Aaj 480 groceries aur 200 petrol, kal Raju ko 1000 udhaar diya"
          className="field mt-3 min-h-36 resize-none"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {sampleInputs.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setInputText(sample)}
              className="secondary-button rounded-full px-4 py-2 text-xs font-semibold"
            >
              {sample}
            </button>
          ))}
        </div>

        <details className="mt-4 rounded-[0.9rem] border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            Show voice options
          </summary>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Voice capture</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Speak naturally. Multiple money updates will be split into separate
                previews.
              </p>
            </div>
            {isVoiceSupported ? (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isParsing || isSaving}
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
            <div className="mt-4 rounded-[1.2rem] bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100">
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
        </details>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || isSaving || inputText.trim().length < 2}
            className="primary-button rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isParsing ? "Reviewing..." : "Generate preview"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="secondary-button rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : saveButtonLabel}
          </button>
        </div>

        {error ? (
          <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {saveMessage ? (
          <p className="status-positive mt-4 rounded-2xl border px-4 py-3 text-sm">
            {saveMessage}
          </p>
        ) : null}

        {duplicateMessage ? (
          <p className="status-warn mt-4 rounded-2xl border px-4 py-3 text-sm">
            {duplicateMessage}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div className="soft-card rounded-[1rem] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow text-brand">Preview</p>
            {result ? (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span className="rounded-lg bg-brand-soft px-3 py-1 text-brand">
                  {result.parserMode}
                </span>
                <span className="rounded-lg bg-white px-3 py-1">
                  {Math.round(result.confidence * 100)}% confidence
                </span>
              </div>
            ) : null}
          </div>

          {!result ? (
            <div className="mt-4 rounded-[0.95rem] border border-dashed border-slate-300/80 bg-white px-5 py-7 text-sm leading-7 text-slate-500">
              No preview yet. Enter one or more money updates and review each parsed
              item here.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-7 text-slate-600">{result.summaryText}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[0.85rem] bg-white px-4 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Total found
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">
                    {result.actions.length}
                  </p>
                </div>
                <div className="rounded-[0.85rem] bg-white px-4 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ready now
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700">
                    {readyCount}
                  </p>
                </div>
                <div className="rounded-[0.85rem] bg-white px-4 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Selected
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">
                    {selectedActions.length}
                  </p>
                </div>
              </div>

              {blockedCount > 0 ? (
                <div className="status-warn rounded-[1.4rem] border px-4 py-4 text-sm">
                  <p className="font-semibold">Some items still need clarification</p>
                  <p className="mt-2">
                    {result.clarificationQuestion ??
                      "Only the ready items can be selected and saved right now."}
                  </p>
                </div>
              ) : (
                <div className="status-positive rounded-[1.4rem] border px-4 py-4 text-sm">
                  All reviewed items are ready for confirmation.
                </div>
              )}

              {readyCount > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIndexes(readyIndexes)}
                    className="secondary-button rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    Select all ready
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIndexes([])}
                    className="secondary-button rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {result?.actions.map((action, index) => {
          const ready = isActionReady(action);

          return (
            <ParsePreviewCard
              key={`${action.sourceText}-${index}`}
              action={action}
              index={index}
              isReadyToSave={ready}
              canSelect={ready}
              isSelected={selectedIndexes.includes(index)}
              onToggleSelect={() => handleToggleSelect(index)}
            />
          );
        })}

        <details className="soft-card rounded-[1rem] p-4 sm:p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            Show live voice assistant
          </summary>
          <div className="mt-5">
            <RealtimeVoicePanel />
          </div>
        </details>
      </div>
    </section>
  );
}
