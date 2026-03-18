"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useBrowserVoice } from "@/hooks/use-browser-voice";
import type {
  AskAiConversationMessage,
  AskAiResponse,
} from "@/lib/ai/ask-contract";
import { RealtimeVoicePanel } from "@/components/entry/realtime-voice-panel";

const ASK_SESSION_WINDOW_MS = 5 * 60 * 1000;

export type AskMode = "chat" | "voice";

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
  mode?: AskMode;
  onModeChange?: (mode: AskMode) => void;
};

export function AskAiWorkspace({
  timezone,
  mode: controlledMode,
}: AskAiWorkspaceProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const mode = controlledMode ?? "chat";

  useEffect(() => {
    const viewport = messageViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, mode]);

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
  } = useBrowserVoice({
    locale: "hi-IN",
    onFinalTranscript: async (transcript) => {
      setQuestion(transcript);
      setVoiceMessage("Sending your question...");
      handleAsk(transcript, true);
    },
  });

  const handleAsk = (
    nextQuestion = question,
    fromVoice = false,
    retryTargetId?: string,
  ) => {
    startTransition(async () => {
      setError(null);
      setVoiceMessage(null);
      setSessionMessage(null);

      const trimmedQuestion = nextQuestion.trim();

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
          .slice(-8)
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

        if (fromVoice) {
          setVoiceMessage("Answer ready in chat.");
          speakText(payload.answerText, "en-IN");
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

        if (fromVoice) {
          setVoiceMessage("I could not answer that clearly. Please try again.");
          speakText("I could not answer that clearly. Please try again.", "en-IN");
        }
      }
    });
  };

  return (
    <section className="space-y-4">
      {mode === "chat" ? (
        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Money chat</p>
              <p className="mt-1 text-xs text-gray-500">{sessionLabel}</p>
            </div>

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
          </div>

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
        </section>
      ) : (
        <RealtimeVoicePanel />
      )}
    </section>
  );
}
