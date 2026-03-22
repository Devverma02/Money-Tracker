"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ParsePreviewCard } from "@/components/entry/parse-preview-card";
import { useNativeSpeech } from "@/hooks/use-native-speech";
import type { ParseResult, ParsedAction } from "@/lib/ai/parse-contract";
import type {
  PersonConflict,
  SaveEntryConflictResponse,
  SaveEntryResponse,
} from "@/lib/ledger/save-contract";
import {
  getSpeechLocaleForLanguage,
  type EntryInputPreferenceValue,
  type PreferredLanguageValue,
} from "@/lib/settings/settings-contract";
import type { RecurringSuggestion } from "@/lib/summaries/types";
import { getVoiceReplyContext, voiceText, type VoiceReplyContext } from "@/lib/voice/voice-localization";

type TextEntryWorkspaceProps = {
  timezone: string;
  defaultBucket: string;
  preferredLanguage: PreferredLanguageValue;
  voiceRepliesEnabled: boolean;
  initialInputMode: EntryInputPreferenceValue;
  recurringSuggestions?: RecurringSuggestion[];
  initialDraftSeed?: string | null;
  onDraftSeedConsumed?: () => void;
};

type EntryInputMode = "mic" | "typing";

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
  preferredLanguage,
  voiceRepliesEnabled,
  initialInputMode,
  recurringSuggestions = [],
  initialDraftSeed = null,
  onDraftSeedConsumed,
}: TextEntryWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [personConflicts, setPersonConflicts] = useState<Record<number, PersonConflict>>({});
  const [voiceReplyContext, setVoiceReplyContext] = useState<VoiceReplyContext>({
    mode: "english",
    speechLang: "en-IN",
  });
  const [awaitingVoiceClarification, setAwaitingVoiceClarification] = useState(false);
  const [voiceConversationText, setVoiceConversationText] = useState("");
  const [lastInputMode, setLastInputMode] = useState<"text" | "voice" | null>(null);
  const [entryInputMode, setEntryInputMode] = useState<EntryInputMode>(
    initialInputMode === "MIC" ? "mic" : "typing",
  );
  const [isParsing, startParseTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  useEffect(() => {
    setSelectedIndexes(getReadyActionIndexes(result));
  }, [result]);

  useEffect(() => {
    if (!initialDraftSeed) {
      return;
    }

    setEntryInputMode("typing");
    setInputText(initialDraftSeed);
    onDraftSeedConsumed?.();
  }, [initialDraftSeed, onDraftSeedConsumed]);

  const readyIndexes = useMemo(() => getReadyActionIndexes(result), [result]);
  const readyCount = readyIndexes.length;
  const selectedReadyIndexes = selectedIndexes.filter((index) =>
    readyIndexes.includes(index),
  );
  const selectedActions =
    result?.actions.filter((_, index) => selectedReadyIndexes.includes(index)) ?? [];
  const blockedCount = result ? result.actions.length - readyCount : 0;
  const selectedConflictIndexes = selectedReadyIndexes.filter((index) => {
    const conflict = personConflicts[index];
    if (!conflict) {
      return false;
    }

    const action = result?.actions[index];
    if (!action) {
      return true;
    }

    return !action.resolvedPersonId && !action.createPersonLabel;
  });
  const canSave =
    selectedActions.length > 0 &&
    selectedConflictIndexes.length === 0 &&
    !isParsing &&
    !isSaving;

  const buildVoiceReply = (parseResult: ParseResult, context: VoiceReplyContext) => {
    const readyItems = parseResult.actions.filter(isActionReady).length;
    const blockedItems = parseResult.actions.length - readyItems;

    if (parseResult.actions.length === 0) {
      return voiceText(context, {
        english: "I heard you. Please try again with a money update.",
        hinglish: "Maine suna. Ek baar fir se money update boliye.",
        hindi: "मैंने सुना। कृपया पैसे की बात फिर से बोलिए।",
      });
    }

    if (blockedItems > 0 && readyItems === 0) {
      return parseResult.clarificationQuestion
        ? parseResult.clarificationQuestion
        : voiceText(context, {
            english: "I found the update, but it still needs one more detail before saving.",
            hinglish: "Update mil gaya hai, lekin save se pehle ek aur detail chahiye.",
            hindi: "अपडेट मिल गया है, लेकिन सेव करने से पहले एक और जानकारी चाहिए।",
          });
    }

    if (parseResult.actions.length === 1) {
      const firstAction = parseResult.actions[0];
      const actionLabelMap: Record<
        NonNullable<ParsedAction["entryType"]>,
        { english: string; hinglish: string; hindi: string }
      > = {
        expense: {
          english: "an expense",
          hinglish: "ek expense",
          hindi: "एक खर्च",
        },
        income: {
          english: "an income entry",
          hinglish: "ek income entry",
          hindi: "एक आमदनी एंट्री",
        },
        loan_given: {
          english: "a loan given",
          hinglish: "diya hua loan",
          hindi: "दिया हुआ उधार",
        },
        loan_taken: {
          english: "a borrowed amount",
          hinglish: "liya hua loan",
          hindi: "लिया हुआ उधार",
        },
        loan_received_back: {
          english: "a loan received back",
          hinglish: "wapas mila loan",
          hindi: "वापस मिला उधार",
        },
        loan_repaid: {
          english: "a loan repayment",
          hinglish: "loan repayment",
          hindi: "उधार की वापसी",
        },
        savings_deposit: {
          english: "a savings deposit",
          hinglish: "savings deposit",
          hindi: "बचत जमा",
        },
        note: {
          english: "a note",
          hinglish: "ek note",
          hindi: "एक नोट",
        },
      };
      const actionLabel = firstAction?.entryType
        ? voiceText(context, actionLabelMap[firstAction.entryType])
        : voiceText(context, {
            english: "an entry",
            hinglish: "ek entry",
            hindi: "एक एंट्री",
          });
      const amountText =
        firstAction?.amount !== null && firstAction?.amount !== undefined
          ? voiceText(context, {
              english: ` for rupees ${firstAction.amount}`,
              hinglish: ` ${firstAction.amount} rupaye ki`,
              hindi: ` ${firstAction.amount} रुपये की`,
            })
          : "";

      return voiceText(context, {
        english: `I heard ${actionLabel}${amountText}. Please review and confirm to save.`,
        hinglish: `Maine ${actionLabel}${amountText} entry suni hai. Save karne se pehle review karke confirm kijiye.`,
        hindi: `मैंने ${actionLabel}${amountText} एंट्री सुनी है। सेव करने से पहले देखकर पुष्टि कीजिए।`,
      });
    }

    if (blockedItems === 0) {
      return voiceText(context, {
        english: `I found ${parseResult.actions.length} entries. They are ready for your review and save.`,
        hinglish: `Mujhe ${parseResult.actions.length} entries mili hain. Ye review aur save ke liye ready hain.`,
        hindi: `मुझे ${parseResult.actions.length} एंट्रियाँ मिली हैं। ये देखने और सेव करने के लिए तैयार हैं।`,
      });
    }

    return voiceText(context, {
      english: `I found ${parseResult.actions.length} entries. ${readyItems} are ready, and ${blockedItems} still need clarification.`,
      hinglish: `Mujhe ${parseResult.actions.length} entries mili hain. ${readyItems} ready hain aur ${blockedItems} me abhi clarification chahiye.`,
      hindi: `मुझे ${parseResult.actions.length} एंट्रियाँ मिली हैं। ${readyItems} तैयार हैं और ${blockedItems} में अभी और जानकारी चाहिए।`,
    });
  };

  const localizeClarificationQuestion = (
    clarificationQuestion: string | null,
    context: VoiceReplyContext,
  ) => {
    const normalized = clarificationQuestion?.toLowerCase() ?? "";

    if (!clarificationQuestion) {
      return voiceText(context, {
        english: "I need one more detail before I can prepare the entry.",
        hinglish: "Entry taiyar karne ke liye mujhe ek aur detail chahiye.",
        hindi: "Entry taiyar karne ke liye mujhe ek aur detail chahiye.",
      });
    }

    if (/what is the amount/.test(normalized)) {
      return voiceText(context, {
        english: clarificationQuestion,
        hinglish: "Amount clear nahi hua. Kitne rupaye the, dobara boliye.",
        hindi: "Amount clear nahi hua. Kitne rupaye the, dobara boliye.",
      });
    }

    if (/expense, income, or loan-related/.test(normalized)) {
      return voiceText(context, {
        english: clarificationQuestion,
        hinglish: "Ye expense hai, income hai, ya loan wali entry hai? Bas itna bol dijiye.",
        hindi: "Ye expense hai, income hai, ya loan wali entry hai? Bas itna bol dijiye.",
      });
    }

    if (/which date should i use/.test(normalized)) {
      return voiceText(context, {
        english: clarificationQuestion,
        hinglish: "Date clear nahi hui. Kaunsi date thi, fir se bol dijiye.",
        hindi: "Date clear nahi hui. Kaunsi date thi, fir se bol dijiye.",
      });
    }

    return clarificationQuestion;
  };

  const buildVoiceResponse = (parseResult: ParseResult, context: VoiceReplyContext) => {
    const readyItems = parseResult.actions.filter(isActionReady).length;
    const blockedItems = parseResult.actions.length - readyItems;

    if (parseResult.actions.length === 0) {
      return {
        reply: voiceText(context, {
          english: "I could not understand the full update. Please say the missing part once more.",
          hinglish: "Main poori baat samajh nahi paya. Jo part reh gaya hai, wo fir se bol dijiye.",
          hindi: "Main poori baat samajh nahi paya. Jo part reh gaya hai, wo fir se bol dijiye.",
        }),
        shouldRelisten: true,
      };
    }

    if (blockedItems > 0) {
      return {
        reply: localizeClarificationQuestion(parseResult.clarificationQuestion, context),
        shouldRelisten: true,
      };
    }

    return {
      reply: buildVoiceReply(parseResult, context),
      shouldRelisten: false,
    };
  };

  const runParse = (nextInputText: string, source: "text" | "voice") => {
    startParseTransition(async () => {
      setError(null);
      setSaveMessage(null);
      setDuplicateMessage(null);
      setVoiceMessage(null);
      setPersonConflicts({});
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
          const context = getVoiceReplyContext(nextInputText);
          setVoiceReplyContext(context);
          const voiceResponse = buildVoiceResponse(payload, context);
          setVoiceMessage(voiceResponse.reply);
          setVoiceConversationText(nextInputText);
          setAwaitingVoiceClarification(voiceResponse.shouldRelisten);
          speakIfEnabled(voiceResponse.reply, context.speechLang, () => {
            if (voiceResponse.shouldRelisten) {
              startListening();
            }
          });
        }
      } catch {
        setResult(null);
        setError("The parser is unavailable right now. Please try again.");

        if (source === "voice") {
          const context = getVoiceReplyContext(nextInputText);
          setVoiceReplyContext(context);
          const reply = voiceText(context, {
            english: "I could not catch that clearly. Please try speaking once more.",
            hinglish: "Main isko clearly samajh nahi paya. Ek baar fir se boliye.",
            hindi: "मैं इसे साफ़ समझ नहीं पाया। कृपया एक बार फिर बोलिए।",
          });
          setVoiceMessage(reply);
          speakIfEnabled(reply, context.speechLang);
          setVoiceConversationText(nextInputText);
          setAwaitingVoiceClarification(false);
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
    locale: getSpeechLocaleForLanguage(preferredLanguage),
    onFinalTranscript: async (transcript) => {
      const combinedTranscript =
        awaitingVoiceClarification && voiceConversationText.trim().length > 0
          ? `${voiceConversationText.trim()} ${transcript.trim()}`.trim()
          : transcript;

      setInputText(combinedTranscript);
      runParse(combinedTranscript, "voice");
    },
  });

  const handleParse = () => {
    runParse(inputText, "text");
  };

  const speakIfEnabled = (text: string, language: string, onEnd?: () => void) => {
    if (!voiceRepliesEnabled) {
      onEnd?.();
      return;
    }

    speakText(text, language, onEnd);
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((left, right) => left - right),
    );
  };

  const handleActionUpdate = (actionIndex: number, updated: ParsedAction) => {
    if (!result) {
      return;
    }

    const updatedActions = result.actions.map((existing, idx) =>
      idx === actionIndex ? updated : existing,
    );
    const nextSummary = buildResultSummary(updatedActions);
    setResult({
      ...result,
      actions: updatedActions,
      ...nextSummary,
    });
    setPersonConflicts((current) => {
      if (!(actionIndex in current)) {
        return current;
      }

      const next = { ...current };
      delete next[actionIndex];
      return next;
    });
  };

  const handleResolvePersonConflict = (
    actionIndex: number,
    resolution:
      | {
          mode: "existing";
          personId: string;
        }
      | {
          mode: "create";
          label: string;
        },
  ) => {
    if (!result) {
      return;
    }

    const updatedActions = result.actions.map((existing, idx) => {
      if (idx !== actionIndex) {
        return existing;
      }

      if (resolution.mode === "existing") {
        return {
          ...existing,
          resolvedPersonId: resolution.personId,
          createPersonLabel: null,
        };
      }

      return {
        ...existing,
        resolvedPersonId: null,
        createPersonLabel: resolution.label,
      };
    });

    const nextSummary = buildResultSummary(updatedActions);
    setResult({
      ...result,
      actions: updatedActions,
      ...nextSummary,
    });
  };

  const handleSave = () => {
    if (!result || !canSave) {
      return;
    }

    startSaveTransition(async () => {
      setError(null);
      setSaveMessage(null);
      setDuplicateMessage(null);
      setPersonConflicts({});

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

        const payload = (await response.json()) as
          | SaveEntryResponse
          | SaveEntryConflictResponse
          | { error?: string };

        if (response.status === 409) {
          if (!("conflicts" in payload) || !Array.isArray(payload.conflicts)) {
            throw new Error("The save response was invalid.");
          }

          const nextConflicts = Object.fromEntries(
            payload.conflicts.map((conflict) => [conflict.actionIndex, conflict]),
          );
          setPersonConflicts(nextConflicts);
          throw new Error(payload.message);
        }

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

        setPersonConflicts({});
        setSaveMessage(payload.message);
        setDuplicateMessage(
          payload.duplicateWarningCount > 0
            ? `${payload.duplicateWarningCount} saved item(s) look similar to recent history. Please review History.`
            : null,
        );

        if (lastInputMode === "voice") {
          speakIfEnabled(
            voiceText(voiceReplyContext, {
              english:
                payload.savedCount === 1
                  ? "Saved successfully."
                  : "Entries saved successfully.",
              hinglish:
                payload.savedCount === 1
                  ? "Entry successfully save ho gayi."
                  : "Entries successfully save ho gayi hain.",
              hindi:
                payload.savedCount === 1
                  ? "एंट्री सफलतापूर्वक सेव हो गई।"
                  : "एंट्रियाँ सफलतापूर्वक सेव हो गई हैं।",
            }),
            voiceReplyContext.speechLang,
          );
        }
        setAwaitingVoiceClarification(false);
        setVoiceConversationText("");

        const remainingActions = result.actions.filter(
          (_, index) => !selectedReadyIndexes.includes(index),
        );

        if (remainingActions.length === 0) {
          setInputText("");
          setResult(null);
          setAwaitingVoiceClarification(false);
          setVoiceConversationText("");
          setPersonConflicts({});
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
    <section className="grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
      {/* ── Input panel ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEntryInputMode("mic")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                entryInputMode === "mic"
                  ? "bg-[#0d9488] text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Mic
            </button>
            <button
              type="button"
              onClick={() => setEntryInputMode("typing")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                entryInputMode === "typing"
                  ? "bg-[#0d9488] text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Typing
            </button>
          </div>
          <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-400">
            Bucket: {defaultBucket}
          </span>
        </div>

        {entryInputMode === "typing" ? (
          <>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="Type here"
              className="field mt-4 min-h-32 resize-none rounded-lg"
            />

            {recurringSuggestions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {recurringSuggestions.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInputText(item.suggestedText)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#0d9488] hover:text-[#0d9488]"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {entryInputMode === "mic" ? (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {isVoiceSupported ? (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isParsing || isSaving}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 ${
                    isListening ? "bg-red-500" : "primary-button"
                  }`}
                >
                  {isListening ? "Stop mic" : "Start mic"}
                </button>
              ) : (
                <span className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400">
                  Browser mic not supported
                </span>
              )}
            </div>

            {isListening || liveTranscript ? (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-gray-700">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0d9488]">
                  {isListening ? "Listening..." : "Captured transcript"}
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
          </div>
        ) : null}
        {/* Action buttons */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {entryInputMode === "typing" ? (
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing || isSaving || inputText.trim().length < 2}
              className="primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isParsing ? "Reviewing..." : "Generate preview"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : saveButtonLabel}
          </button>
        </div>

        {error ? (
          <p className="status-danger mt-3 rounded-lg border px-3 py-2 text-sm">{error}</p>
        ) : null}

        {saveMessage ? (
          <p className="status-positive mt-3 rounded-lg border px-3 py-2 text-sm">{saveMessage}</p>
        ) : null}

        {duplicateMessage ? (
          <p className="status-warn mt-3 rounded-lg border px-3 py-2 text-sm">{duplicateMessage}</p>
        ) : null}
      </div>

      {/* ── Preview panel ── */}
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
            {result ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-[#0d9488]">
                  {result.parserMode}
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
            ) : null}
          </div>

          {!result ? (
            <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
              No preview yet.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Inline summary replacing 3 stat cards */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-900">
                  {result.actions.length} found
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  {readyCount} ready
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 font-medium text-[#0d9488]">
                  {selectedActions.length} selected
                </span>
              </div>

              {blockedCount > 0 ? (
                <div className="status-warn rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">Some items need clarification</p>
                  <p className="mt-0.5 text-xs">
                    {result.clarificationQuestion ??
                      "Only ready items can be selected and saved."}
                  </p>
                </div>
              ) : (
                <div className="status-positive rounded-lg border px-3 py-2 text-sm">
                  All items are ready for confirmation.
                </div>
              )}

              {selectedConflictIndexes.length > 0 ? (
                <div className="status-warn rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">Person name needs confirmation</p>
                  <p className="mt-0.5 text-xs">
                    {selectedConflictIndexes.length === 1
                      ? "One selected entry matches multiple people. Choose the right person or create a new label before saving."
                      : `${selectedConflictIndexes.length} selected entries match multiple people. Resolve them before saving.`}
                  </p>
                </div>
              ) : null}

              {readyCount > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedIndexes(readyIndexes)}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIndexes([])}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Clear
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
              personConflict={personConflicts[index] ?? null}
              onToggleSelect={() => handleToggleSelect(index)}
              onActionUpdate={handleActionUpdate}
              onResolvePersonConflict={handleResolvePersonConflict}
            />
          );
        })}

      </div>
    </section>
  );
}

