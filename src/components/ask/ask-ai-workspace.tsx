"use client";

import { useState, useTransition } from "react";
import type { AskAiResponse } from "@/lib/ai/ask-contract";

const sampleQuestions = [
  "How much did I spend today?",
  "What is my income this week?",
  "Do I have any pending loans?",
];

type AskAiWorkspaceProps = {
  timezone: string;
};

export function AskAiWorkspace({ timezone }: AskAiWorkspaceProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAsk = () => {
    startTransition(async () => {
      setError(null);

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
            timezone,
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

        setAnswer(payload);
      } catch (caughtError) {
        setAnswer(null);
        setError(
          caughtError instanceof Error ? caughtError.message : "Ask AI failed.",
        );
      }
    });
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="shell-card rounded-[2rem] p-6 sm:p-7">
        <p className="eyebrow text-brand">Ask AI</p>
        <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950 sm:text-4xl">
          Ask questions over saved financial facts.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          This assistant answers from structured summaries and retrieved records. It does
          not make up numbers from raw chat history.
        </p>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Your question
        </label>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: How much did I spend this week?"
          className="field mt-3 min-h-36 resize-none"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {sampleQuestions.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setQuestion(sample)}
              className="secondary-button rounded-full px-4 py-2 text-xs font-semibold"
            >
              {sample}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAsk}
          disabled={isPending || question.trim().length < 3}
          className="primary-button mt-6 rounded-full px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Preparing answer..." : "Ask AI"}
        </button>

        {error ? (
          <p className="status-danger mt-4 rounded-2xl border px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div className="soft-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow text-brand">Answer</p>
            {answer ? (
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                  {answer.parserMode}
                </span>
                <span className="rounded-full bg-white px-3 py-1">
                  {answer.resolvedPeriod}
                </span>
              </div>
            ) : null}
          </div>

          {!answer ? (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300/80 bg-white/60 px-5 py-7 text-sm leading-7 text-slate-500">
              Ask a question to see a grounded answer built from saved records.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-base leading-8 text-slate-900 sm:text-lg">
                {answer.answerText}
              </p>
              {answer.uncertaintyNote ? (
                <div className="status-warn rounded-[1.4rem] border px-4 py-4 text-sm">
                  {answer.uncertaintyNote}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {answer ? (
          <div className="soft-card rounded-[2rem] p-5 sm:p-6">
            <p className="eyebrow text-brand">Facts used</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {answer.factualPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-[1.2rem] border border-white/70 bg-white/75 px-4 py-3"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
