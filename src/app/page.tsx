import Link from "next/link";
import { AppFooter } from "@/components/chrome/app-footer";
import { PublicHeader } from "@/components/chrome/public-header";
import { createClient } from "@/lib/supabase/server";

const trustPoints = [
  {
    title: "Nothing saves without review",
    description:
      "Every money update turns into a preview first. You confirm what should be saved.",
  },
  {
    title: "Voice and typing both work",
    description:
      "Use device speech when you want speed, or type when you want full control.",
  },
  {
    title: "AI answers use saved records",
    description:
      "Ask questions over your actual entries, reminders, people, and balances.",
  },
];

const useCases = [
  "Daily expense and income tracking",
  "Loan given and loan taken records",
  "Reminder follow-ups for payments and people",
  "Person-wise balances in one loan book",
  "Monthly understanding of cash in, cash out, and pending loans",
  "Fast review before save for voice-based entries",
];

const workflowSteps = [
  {
    step: "01",
    title: "Capture your update",
    description:
      "Speak or type a natural sentence such as multiple expenses, an income, or a loan update.",
  },
  {
    step: "02",
    title: "Review the preview",
    description:
      "JebKitab splits the sentence into cards, fills date, type, person, and amount, then highlights anything still missing.",
  },
  {
    step: "03",
    title: "Save only what is correct",
    description:
      "You can edit, select, or leave incomplete items. Only selected ready items are saved.",
  },
];

const featureGrid = [
  {
    title: "Quick entry",
    description:
      "Capture expenses, income, savings, and loans with one text box or one mic.",
  },
  {
    title: "Ask AI",
    description:
      "Get grounded answers about balances, spending, people, reminders, and period summaries.",
  },
  {
    title: "Reminder engine",
    description:
      "Create due reminders, follow-ups, snooze actions, and push alerts from one place.",
  },
  {
    title: "People ledger",
    description:
      "Track who owes you, who you owe, aliases, merges, and person-level history.",
  },
  {
    title: "Opening setup",
    description:
      "Start with your current balance and existing loans so the app understands your real position from day one.",
  },
  {
    title: "Balance guard",
    description:
      "Warn before saving an expense that goes below the tracked balance you have set.",
  },
];

const faqs = [
  {
    question: "Does the app auto-save what AI hears?",
    answer:
      "No. The app always shows a preview first. You decide what gets saved.",
  },
  {
    question: "Can I use Hindi, Hinglish, or English?",
    answer:
      "Yes. Voice and Ask AI support all three, while the website UI stays simple and consistent.",
  },
  {
    question: "Can I track loans and reminders together?",
    answer:
      "Yes. Loan entries, person balances, reminders, and Ask AI all work together from the same saved records.",
  },
  {
    question: "What if I am starting today with existing money data?",
    answer:
      "Use the opening setup to add your current balance and current pending loans once.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  let user = null;

  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "refresh_token_not_found"
    ) {
      throw error;
    }
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="hero-reveal pb-12 pt-16 sm:pb-16 sm:pt-20 lg:pt-24">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0d9488]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0d9488]" />
                Trust-first money tracking for real daily use
              </div>

              <h1 className="mt-5 font-mono text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
                JebKitab helps you track money
                <span className="text-[#0d9488]"> the simple way</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-500 sm:text-lg">
                Track expenses, income, loans, reminders, and people from one
                workspace. Speak naturally, review every preview, and save only
                what looks right.
              </p>

              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="primary-button inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
                >
                  Open dashboard
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
                {!user ? (
                  <Link
                    href="/login"
                    className="secondary-button inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold"
                  >
                    Sign in with Google
                  </Link>
                ) : null}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {trustPoints.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-gray-500">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
                  Why people use it
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-gray-900">
                  One place for the full money picture
                </h2>
                <div className="mt-5 space-y-3">
                  {useCases.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3"
                    >
                      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-[#0d9488]">
                        ✓
                      </span>
                      <p className="text-sm leading-6 text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <div className="max-w-2xl">
              <p className="eyebrow text-[#0d9488]">How JebKitab works</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900 sm:text-3xl">
                Built to reduce wrong saves, not just collect entries
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-500 sm:text-base">
                The app is designed around one simple rule: understanding can be
                smart, but saving money records must stay explicit and reviewable.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {workflowSteps.map((item) => (
                <article
                  key={item.step}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-5"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="text-center">
            <p className="eyebrow text-[#0d9488]">What you get</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900 sm:text-3xl">
              Everything important stays connected
            </h2>
            <p className="mt-3 text-sm text-gray-500 sm:text-base">
              Entries, people, reminders, summaries, and Ask AI all work from the
              same saved records.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featureGrid.map((item) => (
              <article
                key={item.title}
                className="soft-card rounded-xl border border-gray-200 p-5"
              >
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 sm:p-8">
              <p className="eyebrow text-[#0d9488]">Good for new users too</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                Start from your current real position
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-600 sm:text-base">
                JebKitab can start with your current balance and your current
                pending loans, so you do not need to recreate your full past from
                day one.
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-white/80 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Opening balance setup
                  </p>
                  <p className="mt-1.5 text-sm text-gray-500">
                    Save the money you currently have before adding new expenses.
                  </p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Existing loan positions
                  </p>
                  <p className="mt-1.5 text-sm text-gray-500">
                    Add who should pay you and who you still need to pay.
                  </p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Balance guard
                  </p>
                  <p className="mt-1.5 text-sm text-gray-500">
                    Get a warning before saving an expense larger than the tracked
                    balance.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
              <p className="eyebrow text-[#0d9488]">Frequently asked</p>
              <div className="mt-4 space-y-3">
                {faqs.map((item) => (
                  <details
                    key={item.question}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
                      {item.question}
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-10">
            <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Ready to use JebKitab daily?
            </h2>
            <p className="mt-3 text-sm text-gray-500 sm:text-base">
              Open the dashboard, set your current position, and start tracking
              from today.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="primary-button rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Open dashboard
              </Link>
              {!user ? (
                <Link
                  href="/login"
                  className="secondary-button rounded-lg px-5 py-2.5 text-sm font-semibold"
                >
                  Sign in
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
