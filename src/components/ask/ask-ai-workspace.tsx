"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useBrowserVoice } from "@/hooks/use-browser-voice";
import type {
  AskAiConversationMessage,
  AskAiResponse,
} from "@/lib/ai/ask-contract";
import { RealtimeVoicePanel } from "@/components/entry/realtime-voice-panel";

const sampleQuestions = [
  "How much did I spend today?",
  "What is my income this week?",
  "Do I have any pending loans?",
  "How much did I spend in the last 3 months?",
];

const ASK_SESSION_WINDOW_MS = 5 * 60 * 1000;

type AskMode = "chat" | "voice";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  answerMeta?: AskAiResponse | null;
};

function createMessageId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type AskAiWorkspaceProps = {
  timezone: string;
};

export function AskAiWorkspace({ timezone }: AskAiWorkspaceProps) {
  const [mode, setMode] = useState<AskMode>("chat");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = messageViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, mode]);

  const sessionLabel = useMemo(() => {
    if (!lastActivityAt || messages.length === 0) {
      return "New chat";
    }

    const secondsSinceLastActivity = Math.floor((Date.now() - lastActivityAt) / 1000);
    const secondsRemaining = Math.max(
      0,
      ASK_SESSION_WINDOW_MS / 1000 - secondsSinceLastActivity,
    );
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;

    return `Session resets in ${minutes}:${String(seconds).padStart(2, "0")}`;
  }, [lastActivityAt, messages.length]);

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

  const handleAsk = (nextQuestion = question, fromVoice = false) => {
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
      const activeMessages = sessionExpired ? [] : messages;

      if (sessionExpired) {
        setMessages([]);
        setSessionMessage(
          "Previous chat expired after 5 minutes of inactivity. A new chat started.",
        );
      }

      const userMessage: ChatMessage = {
        id: createMessageId("user"),
        role: "user",
        text: trimmedQuestion,
      };

      setMessages((current) => (sessionExpired ? [userMessage] : [...current, userMessage]));
      setQuestion("");
      setLastActivityAt(now);

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
        setMessages((current) =>
          current.filter((messageItem) => messageItem.id !== userMessage.id),
        );

        if (fromVoice) {
          setVoiceMessage("I could not answer that clearly. Please try again.");
          speakText("I could not answer that clearly. Please try again.", "en-IN");
        }
      }
    });
  };

  const latestAssistantAnswer = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.answerMeta)?.answerMeta ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
            Ask AI
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            Chat or talk over saved money facts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Chat mode keeps a short session. Voice mode starts live audio conversation.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === "chat"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMode("voice")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              mode === "voice"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Voice
          </button>
        </div>
      </div>

      {mode === "chat" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-gray-200 bg-white">
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
                <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    Start a normal chat
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Ask naturally, then continue with follow-up questions in the same
                    5-minute chat session.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {sampleQuestions.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setQuestion(sample)}
                        className="secondary-button rounded-full px-3 py-1.5 text-xs font-semibold"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
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
                          ? "bg-[#0d9488] text-white"
                          : "border border-gray-200 bg-gray-50 text-gray-900"
                      }`}
                    >
                      <p className="text-sm leading-7">{message.text}</p>

                      {message.role === "assistant" && message.answerMeta ? (
                        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            <span className="rounded-md bg-white px-2 py-1 text-[#0d9488]">
                              {message.answerMeta.parserMode}
                            </span>
                            <span className="rounded-md bg-white px-2 py-1">
                              {message.answerMeta.resolvedPeriodLabel}
                            </span>
                          </div>

                          {message.answerMeta.uncertaintyNote ? (
                            <div className="status-warn rounded-lg border px-3 py-2 text-xs">
                              {message.answerMeta.uncertaintyNote}
                            </div>
                          ) : null}
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
                <p className="status-danger mb-3 rounded-lg border px-3 py-2 text-sm">
                  {error}
                </p>
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
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">Sample questions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sampleQuestions.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setQuestion(sample)}
                    className="secondary-button rounded-full px-3 py-1.5 text-xs font-semibold"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">How chat mode works</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-500">
                <li>Ask naturally, then continue with follow-up questions.</li>
                <li>Chat session stays alive for 5 minutes of activity.</li>
                <li>Answers are grounded in saved records, not freeform memory.</li>
              </ul>
            </div>

            {latestAssistantAnswer ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">Latest facts used</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-500">
                  {latestAssistantAnswer.factualPoints.map((point) => (
                    <li
                      key={point}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900">Live voice talk</p>
            <p className="mt-1 text-sm text-gray-500">
              Start live audio conversation here. For typed follow-ups, switch back to
              chat mode.
            </p>
          </div>
          <RealtimeVoicePanel />
        </div>
      )}
    </section>
  );
}
