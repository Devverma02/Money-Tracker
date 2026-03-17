import Link from "next/link";
import { AppFooter } from "@/components/chrome/app-footer";
import { PublicHeader } from "@/components/chrome/public-header";
import { createClient } from "@/lib/supabase/server";

const steps = [
  { num: "01", title: "Speak or type", desc: "Natural text or voice in Hindi, English, or Hinglish." },
  { num: "02", title: "Review cards", desc: "Each update becomes a separate preview card for you to check." },
  { num: "03", title: "Confirm & save", desc: "Only save the entries that look right. Nothing auto‑saves." },
];

const features = [
  {
    title: "Multi-entry parsing",
    desc: "One sentence can contain multiple money updates — the app splits, classifies, and previews each one individually.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Voice-first capture",
    desc: "Speak your updates naturally. The app transcribes, parses, and replies back — all in your language.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 19v4m-4 0h8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Smart reminders",
    desc: "Create reminders with natural text. AI understands dates, persons, and follow-ups automatically.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Ask AI, grounded",
    desc: "Get answers based on your actual saved records — no hallucinated numbers, no guessing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const stats = [
  { value: "8+", label: "Entry types supported" },
  { value: "3", label: "Languages understood" },
  { value: "<2s", label: "Average parse time" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Hero ── */}
        <section className="hero-reveal pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0d9488]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0d9488]" />
              Personal finance that respects your data
            </div>
            <h1 className="mt-5 font-mono text-3xl font-bold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Track money the way
              <br className="hidden sm:block" />
              <span className="text-[#0d9488]"> you actually talk</span>
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg">
              Speak or type your expenses, income, and loans naturally.
              MoneyManage parses, previews, and saves — only after you confirm.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/dashboard" className="primary-button inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold">
                Open dashboard
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
              </Link>
              {!user && (
                <Link href="/login" className="secondary-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold">
                  Sign in with Google
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Preview strip ── */}
        <section className="hero-delay rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="eyebrow text-[#0d9488]">How it works</p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">
                Three steps. Full control.
              </h2>
              <div className="mt-5 space-y-3">
                {steps.map((s) => (
                  <div key={s.num} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/30">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0d9488] text-xs font-bold text-white">
                      {s.num}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Voice engine</p>
                <p className="mt-2 font-mono text-xl font-bold text-gray-900">OpenAI STT</p>
                <p className="mt-1.5 text-sm text-gray-500">High-accuracy transcription for Hindi, English, and Hinglish.</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">AI answers</p>
                <p className="mt-2 font-mono text-xl font-bold text-[#6366f1]">Grounded</p>
                <p className="mt-1.5 text-sm text-gray-500">Queried from real records — not chat memory or approximations.</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Default path</p>
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Every entry goes through <span className="font-semibold text-gray-900">capture → preview → confirm</span>. Nothing is silently written to the ledger.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="py-10 sm:py-12">
          <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-5 text-center sm:px-6 sm:py-6">
                <p className="font-mono text-2xl font-bold text-gray-900 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs font-medium text-gray-400 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features grid ── */}
        <section className="pb-12 sm:pb-16">
          <div className="text-center">
            <p className="eyebrow text-[#0d9488]">Features</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">
              Built for speed and trust
            </h2>
            <p className="mt-2 text-sm text-gray-500">Every feature follows the same rule: review before save.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <article key={f.title} className={`soft-card rounded-xl p-5 animate-fade-${Math.min(i + 1, 3)}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
                  {f.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-500">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="pb-12 sm:pb-16">
          <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 text-center sm:p-10">
            <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Ready to take control?</h2>
            <p className="mt-2 text-sm text-gray-500">Start tracking in under 30 seconds. No credit card required.</p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/dashboard" className="primary-button rounded-lg px-5 py-2.5 text-sm font-semibold">
                Open dashboard
              </Link>
              {!user && (
                <Link href="/login" className="secondary-button rounded-lg px-5 py-2.5 text-sm font-semibold">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </section>

      </main>
      <AppFooter />
    </>
  );
}
