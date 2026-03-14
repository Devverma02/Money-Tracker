import Link from "next/link";
import { AppFooter } from "@/components/chrome/app-footer";
import { PublicHeader } from "@/components/chrome/public-header";

const highlights = [
  {
    title: "Fast capture",
    description: "Add spending, income, loans, and reminders through natural text or voice.",
  },
  {
    title: "Review first",
    description: "Every save path stays explicit so nothing important lands silently in the ledger.",
  },
  {
    title: "Grounded answers",
    description: "Ask AI works on structured records, not chat memory or guessed numbers.",
  },
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <section className="hero-card hero-reveal rounded-[1.25rem] px-5 py-7 sm:px-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                Trust-first personal finance
              </span>
              <div className="space-y-4">
                <h1 className="max-w-4xl font-mono text-4xl leading-tight font-semibold text-slate-950 sm:text-5xl lg:text-6xl">
                  A cleaner daily workflow for money entries, reminders, and answers.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600">
                  MoneyManage keeps the flow simple: capture, review, confirm, and then
                  save. AI helps with speed, while the app keeps the final record explicit.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="primary-button inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/login"
                  className="secondary-button inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold"
                >
                  Sign in with Google
                </Link>
              </div>
            </div>

            <div className="hero-delay grid gap-3">
              <div className="soft-card rounded-[1rem] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  Default workflow
                </p>
                <ol className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
                  <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    1. Speak or type one or many money updates.
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    2. Review separate preview cards before saving.
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    3. Save only the selected clear items.
                  </li>
                </ol>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="soft-card rounded-[1rem] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Voice support
                  </p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
                    OpenAI STT
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Voice capture is routed through transcription for stronger recognition.
                  </p>
                </div>
                <div className="soft-card rounded-[1rem] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ask AI
                  </p>
                  <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
                    Grounded
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Answers use saved records, custom ranges, and person/category filters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-6 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="soft-card rounded-[1rem] p-5">
              <div className="mb-4 h-10 w-10 rounded-lg bg-brand-soft" />
              <h2 className="font-mono text-2xl font-semibold text-slate-950">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          ))}
        </section>
      </main>
      <AppFooter />
    </>
  );
}
