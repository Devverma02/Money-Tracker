"use client";

import { useOpenAiRealtimeVoice } from "@/hooks/use-openai-realtime-voice";

const statusCopy: Record<
  "idle" | "connecting" | "connected" | "listening" | "thinking" | "speaking" | "error",
  string
> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Error",
};

export function RealtimeVoicePanel() {
  const {
    status,
    error,
    messages,
    assistantLiveTranscript,
    isConnecting,
    isSupported,
    connect,
    disconnect,
  } = useOpenAiRealtimeVoice();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            {statusCopy[status]}
          </span>
          {assistantLiveTranscript ? (
            <span className="text-sm text-gray-500">Listening live</span>
          ) : null}
        </div>

        {status === "idle" || status === "error" ? (
          <button
            type="button"
            onClick={connect}
            disabled={!isSupported || isConnecting}
            className="primary-button rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isConnecting ? "Starting..." : "Start live voice"}
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            className="secondary-button rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            End live voice
          </button>
        )}
      </div>

      {!isSupported ? (
        <p className="status-danger mt-4 rounded-lg border px-4 py-3 text-sm">
          This browser does not support WebRTC voice sessions.
        </p>
      ) : null}

      {error ? (
        <p className="status-danger mt-4 rounded-lg border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      {assistantLiveTranscript ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-7 text-gray-700">
          <p>{assistantLiveTranscript}</p>
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div className="mt-4 space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-700"
            >
              {message.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
