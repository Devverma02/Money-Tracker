"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNativeSpeech } from "@/hooks/use-native-speech";
import type {
  AskAiConversationMessage,
  AskAiReplyLanguage,
  AskAiResponse,
} from "@/lib/ai/ask-contract";
import {
  getSpeechLocaleForLanguage,
  type PreferredLanguageValue,
} from "@/lib/settings/settings-contract";
import { getVoiceReplyContext } from "@/lib/voice/voice-localization";

const ASK_SESSION_WINDOW_MS = 5 * 60 * 1000;
type AskMode = "chat" | "live";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  answerMeta?: AskAiResponse | null;
  state?: "normal" | "failed";
};

function createMessageId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type AskAiWorkspaceProps = {
  timezone: string;
  preferredLanguage: PreferredLanguageValue;
  voiceRepliesEnabled: boolean;
};

export function AskAiWorkspace({
  timezone,
  preferredLanguage,
  voiceRepliesEnabled,
}: AskAiWorkspaceProps) {
  const [mode, setMode] = useState<AskMode>("chat");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"idle" | "listening" | "thinking" | "speaking">(
    "idle",
  );
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const isLiveModeActiveRef = useRef(false);

  const resolveReplyLanguage = (text: string): AskAiReplyLanguage => {
    const detected = getVoiceReplyContext(text);

    if (detected.mode === "english") {
      return "english";
    }

    if (detected.mode === "hindi") {
      return "hindi";
    }

    if (detected.mode === "hinglish") {
      return "hinglish";
    }

    if (preferredLanguage === "HINDI") {
      return "hindi";
    }

    if (preferredLanguage === "ENGLISH") {
      return "english";
    }

    return "hinglish";
  };

  const getSpeechLocaleForReply = (language: AskAiReplyLanguage) =>
    language === "hindi" ? "hi-IN" : "en-IN";

  useEffect(() => {
    const viewport = messageViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!lastActivityAt || messages.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lastActivityAt, messages.length]);

  const sessionLabel = useMemo(() => {
    if (!lastActivityAt || messages.length === 0) {
      return "New chat";
    }

    const secondsSinceLastActivity = Math.floor((clockTick - lastActivityAt) / 1000);
    const secondsRemaining = Math.max(
      0,
      ASK_SESSION_WINDOW_MS / 1000 - secondsSinceLastActivity,
    );
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;

    return `Session resets in ${minutes}:${String(seconds).padStart(2, "0")}`;
  }, [clockTick, lastActivityAt, messages.length]);

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
      setQuestion(transcript);
      const replyLanguage = resolveReplyLanguage(transcript);
      setVoiceMessage(
        replyLanguage === "hindi"
          ? "Aapka sawaal bheja ja raha hai..."
          : replyLanguage === "hinglish"
            ? "Aapka sawaal bheja ja raha hai..."
            : "Sending your question...",
      );
      setLiveStatus("thinking");
      handleAsk(transcript, true, undefined, isLiveModeActiveRef.current);
    },
  });

  useEffect(() => {
    isLiveModeActiveRef.current = mode === "live";

    if (mode !== "live") {
      setLiveStatus("idle");
      stopListening();
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    }
  }, [mode, stopListening]);

  const handleAsk = (
    nextQuestion = question,
    fromVoice = false,
    retryTargetId?: string,
    continueLiveMode = false,
  ) => {
    startTransition(async () => {
      setError(null);
      setVoiceMessage(null);
      setSessionMessage(null);

      const trimmedQuestion = nextQuestion.trim();
      const replyLanguage = resolveReplyLanguage(trimmedQuestion);

      if (trimmedQuestion.length < 3) {
        setError("Please enter a longer question.");
        return;
      }

      const now = Date.now();
      const sessionExpired =
        lastActivityAt !== null && now - lastActivityAt > ASK_SESSION_WINDOW_MS;
      const activeMessages = (sessionExpired ? [] : messages).filter(
        (message) =>
          message.state !== "failed" &&
          (!retryTargetId || message.id !== retryTargetId),
      );

      if (sessionExpired) {
        setMessages([]);
        setSessionMessage(
          "Previous chat expired after 5 minutes of inactivity. A new chat started.",
        );
        setRetryMessageId(null);
      }

      const userMessageId = retryTargetId ?? createMessageId("user");
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        text: trimmedQuestion,
        state: "normal",
      };

      setMessages((current) => {
        if (retryTargetId) {
          return current.map((message) =>
            message.id === retryTargetId
              ? { ...message, text: trimmedQuestion, state: "normal" }
              : message,
          );
        }

        return sessionExpired ? [userMessage] : [...current, userMessage];
      });
      setQuestion("");
      setLastActivityAt(now);
      setRetryMessageId(null);

      try {
        const conversation: AskAiConversationMessage[] = activeMessages
          .slice(-4)
          .map((message) => ({
            role: message.role,
            text: message.text,
          }));

        const response = await fetch("/api/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: trimmedQuestion,
            timezone,
            replyLanguage,
            conversation,
          }),
        });

        const payload = (await response.json()) as AskAiResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error ? payload.error : "Ask AI failed.",
          );
        }

        if (!("answerText" in payload)) {
          throw new Error("The AI answer response was invalid.");
        }

        const assistantMessage: ChatMessage = {
          id: createMessageId("assistant"),
          role: "assistant",
          text: payload.answerText,
          answerMeta: payload,
        };
        setMessages((current) => [...current, assistantMessage]);
        setLastActivityAt(Date.now());

        if (fromVoice && (voiceRepliesEnabled || continueLiveMode)) {
          setLiveStatus("speaking");
          setVoiceMessage(
            replyLanguage === "hindi"
              ? "Jawab aa gaya hai."
              : replyLanguage === "hinglish"
                ? "Jawab aa gaya hai."
                : "Answer ready in chat.",
          );
          speakText(
            payload.answerText,
            getSpeechLocaleForReply(replyLanguage),
            () => {
              if (continueLiveMode && isLiveModeActiveRef.current) {
                setLiveStatus("listening");
                startListening();
                return;
              }

              setLiveStatus("idle");
            },
          );
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Ask AI failed.";
        setError(message);
        setRetryMessageId(userMessageId);
        setMessages((current) =>
          current.map((messageItem) =>
            messageItem.id === userMessageId
              ? { ...messageItem, state: "failed" }
              : messageItem,
          ),
        );

        if (fromVoice && (voiceRepliesEnabled || continueLiveMode)) {
          const spokenError =
            replyLanguage === "hindi"
              ? "Main iska sahi jawab abhi nahi de paya. Kripya fir se poochhiye."
              : replyLanguage === "hinglish"
                ? "Main iska sahi jawab abhi nahi de paya. Please fir se poochhiye."
                : "I could not answer that clearly. Please try again.";
          setVoiceMessage(spokenError);
          setLiveStatus("speaking");
          speakText(
            spokenError,
            getSpeechLocaleForReply(replyLanguage),
            () => {
              if (continueLiveMode && isLiveModeActiveRef.current) {
                setLiveStatus("listening");
                startListening();
                return;
              }

              setLiveStatus("idle");
            },
          );
        }
      }
    });
  };

  const startLiveTalk = () => {
    setMode("live");
    setError(null);
    setVoiceMessage(null);
    setLiveStatus("listening");
    startListening();
  };

  const stopLiveTalk = () => {
    isLiveModeActiveRef.current = false;
    setLiveStatus("idle");
    setVoiceMessage(null);
    stopListening();
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <section className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {mode === "chat" ? "Money chat" : "Talk live"}
              </p>
              <p className="mt-1 text-xs text-gray-500">{sessionLabel}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("chat")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === "chat"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Chatting
                </button>
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === "live"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Talk live
                </button>
              </div>

              {mode === "chat" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setLastActivityAt(null);
                    setSessionMessage("Started a fresh chat session.");
                    setError(null);
                  }}
                  className="secondary-button rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  New chat
                </button>
              ) : null}
            </div>
          </div>

          {mode === "chat" ? (
            <>
              <div
                ref={messageViewportRef}
                className="flex max-h-[34rem] min-h-[26rem] flex-col gap-3 overflow-y-auto px-4 py-4"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      Ask anything about your saved money records.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.role === "user"
                            ? message.state === "failed"
                              ? "border border-red-200 bg-red-50 text-red-700"
                              : "bg-[#0d9488] text-white"
                            : "border border-gray-200 bg-gray-50 text-gray-900"
                        }`}
                      >
                        <p className="text-sm leading-7">{message.text}</p>

                        {message.role === "user" && message.state === "failed" ? (
                          <div className="mt-3 border-t border-red-200 pt-3">
                            <button
                              type="button"
                              onClick={() => handleAsk(message.text, false, message.id)}
                              disabled={isPending}
                              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              Retry
                            </button>
                          </div>
                        ) : null}

                        {message.role === "assistant" && message.answerMeta?.uncertaintyNote ? (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="status-warn rounded-lg border px-3 py-2 text-xs">
                              {message.answerMeta.uncertaintyNote}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 px-4 py-4">
                {sessionMessage ? (
                  <p className="status-positive mb-3 rounded-lg border px-3 py-2 text-sm">
                    {sessionMessage}
                  </p>
                ) : null}

                {voiceMessage ? (
                  <p className="status-positive mb-3 rounded-lg border px-3 py-2 text-sm">
                    {voiceMessage}
                  </p>
                ) : null}

                {voiceError ? (
                  <p className="status-danger mb-3 rounded-lg border px-3 py-2 text-sm">
                    {voiceError}
                  </p>
                ) : null}

                {error ? (
                  <div className="status-danger mb-3 rounded-lg border px-3 py-2 text-sm">
                    <p>{error}</p>
                    {retryMessageId ? (
                      <button
                        type="button"
                        onClick={() => {
                          const failedMessage = messages.find(
                            (message) => message.id === retryMessageId,
                          );

                          if (!failedMessage) {
                            return;
                          }

                          void handleAsk(failedMessage.text, false, failedMessage.id);
                        }}
                        disabled={isPending}
                        className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Retry last question
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isListening || liveTranscript ? (
                  <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-gray-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
                      {isListening ? "Listening..." : "Captured question"}
                    </p>
                    <p className="mt-1">{liveTranscript || "Start speaking..."}</p>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask anything about your saved money records..."
                    className="field min-h-[3.25rem] resize-none rounded-xl"
                  />

                  {isVoiceSupported ? (
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      disabled={isPending}
                      className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70 ${
                        isListening ? "bg-emerald-700" : "primary-button"
                      }`}
                    >
                      {isListening ? "Stop" : "Mic"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleAsk()}
                    disabled={isPending || question.trim().length < 3}
                    className="primary-button shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {isPending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-4 py-6">
              <div className="mx-auto flex min-h-[26rem] max-w-3xl flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
                <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
                  {liveStatus === "idle"
                    ? "Idle"
                    : liveStatus === "listening"
                      ? "Listening"
                      : liveStatus === "thinking"
                        ? "Thinking"
                        : "Speaking"}
                </span>

                <h3 className="mt-5 text-2xl font-bold text-gray-900">Talk live</h3>
                <p className="mt-2 max-w-xl text-sm text-gray-500">
                  One mic, natural conversation. You speak, the app answers, then it listens again.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={liveStatus === "idle" ? startLiveTalk : stopLiveTalk}
                    disabled={!isVoiceSupported || isPending}
                    className={`rounded-full px-7 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      liveStatus === "idle" ? "primary-button" : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    {liveStatus === "idle" ? "Start live mic" : "Stop live mic"}
                  </button>
                </div>

                {voiceError ? (
                  <p className="status-danger mt-5 w-full rounded-lg border px-3 py-2 text-sm">
                    {voiceError}
                  </p>
                ) : null}

                {voiceMessage ? (
                  <p className="status-positive mt-5 w-full rounded-lg border px-3 py-2 text-sm">
                    {voiceMessage}
                  </p>
                ) : null}

                {error ? (
                  <p className="status-danger mt-5 w-full rounded-lg border px-3 py-2 text-sm">
                    {error}
                  </p>
                ) : null}

                {liveTranscript ? (
                  <div className="mt-5 w-full rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
                      Live transcript
                    </p>
                    <p className="mt-2 text-sm text-gray-700">{liveTranscript}</p>
                  </div>
                ) : null}

                {messages.length > 0 ? (
                  <div className="mt-5 w-full space-y-3 text-left">
                    {messages.slice(-4).map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-xl px-4 py-3 text-sm ${
                          message.role === "user"
                            ? "bg-[#0d9488] text-white"
                            : "border border-gray-200 bg-white text-gray-900"
                        }`}
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
    </section>
  );
}
