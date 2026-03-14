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
    <div className="soft-card rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-brand">Realtime voice</p>
          <h3 className="mt-3 font-mono text-2xl font-semibold text-slate-950 sm:text-3xl">
            Natural back-and-forth voice with low delay.
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            This mode is for fast conversation. The assistant listens and answers out loud,
            while actual saving still happens only through the reviewed preview flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {statusCopy[status]}
          </span>
          {status === "idle" || status === "error" ? (
            <button
              type="button"
              onClick={connect}
              disabled={!isSupported || isConnecting}
              className="primary-button rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isConnecting ? "Starting live voice..." : "Start live voice"}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnect}
              className="secondary-button rounded-full px-5 py-3 text-sm font-semibold"
            >
              End live voice
            </button>
          )}
        </div>
      </div>

      {!isSupported ? (
        <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
          This browser does not support WebRTC voice sessions.
        </p>
      ) : null}

      {error ? (
        <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      {assistantLiveTranscript ? (
        <div className="mt-5 rounded-[1.5rem] bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Assistant live transcript
          </p>
          <p className="mt-2">{assistantLiveTranscript}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-900">How this mode behaves</p>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
            <li>It listens continuously after you start the live session.</li>
            <li>Replies are kept short so the turn feels natural.</li>
            <li>If you mention a transaction, it should tell you to review the preview before saving.</li>
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-900">Recent assistant replies</p>
          {messages.length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Start the live session and speak naturally. Short assistant replies will appear here.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-[1.2rem] border border-white/70 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
                >
                  {message.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
