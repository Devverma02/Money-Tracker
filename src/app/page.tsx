import Link from "next/link";
import { AppFooter } from "@/components/chrome/app-footer";
import { PublicHeader } from "@/components/chrome/public-header";

const highlights = [
  {
    title: "Capture quickly",
    description: "Record spending, income, and loans through natural text or voice-first flows.",
  },
  {
    title: "Review before save",
    description: "Every important action is previewed first so you can confirm before it touches the ledger.",
  },
  {
    title: "Numbers you can trust",
    description: "Dashboards, reminders, and insights stay grounded in structured records instead of guesswork.",
  },
];

const workflow = [
  "Write or speak a money update in your own words.",
  "Review the parsed preview and fix anything unclear.",
  "Confirm once, then save into the ledger safely.",
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-6 pt-6 sm:px-8 lg:px-10">
        <section className="hero-card hero-reveal relative overflow-hidden rounded-[2.4rem] bg-[linear-gradient(180deg,#101827_0%,#0b1120_100%)] px-6 py-8 text-white sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="grid-fade" />
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
                Trust-first personal finance
              </span>
              <div className="space-y-5">
                <h1 className="max-w-4xl font-mono text-4xl leading-[1.02] font-semibold sm:text-5xl lg:text-7xl">
                  Premium money tracking that feels calm, clear, and reliable.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                  MoneyManage keeps AI in a supporting role. You review the preview,
                  confirm the action, and stay in control of every saved record.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="primary-button inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-white"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/16 bg-white/8 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/14"
                >
                  Sign in with Google
                </Link>
              </div>
            </div>

            <div className="hero-delay grid gap-4">
              <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-100">Trusted workflow</p>
                    <p className="mt-2 text-2xl font-semibold text-white">Nothing saves without a clear review.</p>
                  </div>
                  <span className="rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                    4 steps
                  </span>
                </div>
                <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
                  {workflow.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-5 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                    Net movement
                  </p>
                  <p className="mt-4 font-mono text-3xl font-semibold text-white">
                    Rs 18,420
                  </p>
                  <p className="mt-2 text-sm text-slate-200">
                    Weekly totals grounded in saved entries only.
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-5 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                    Next reminder
                  </p>
                  <p className="mt-4 font-mono text-3xl font-semibold text-white">
                    Tomorrow
                  </p>
                  <p className="mt-2 text-sm text-slate-200">
                    Follow up with Raju about the pending loan payment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-8 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="soft-card rounded-[1.8rem] p-6">
              <div className="mb-5 h-12 w-12 rounded-2xl bg-brand-soft" />
              <h2 className="font-mono text-2xl font-semibold text-slate-950">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                {item.description}
              </p>
            </article>
          ))}
        </section>
      </main>
      <AppFooter />
    </>
  );
}
