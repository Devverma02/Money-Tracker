import { AskAiWorkspace } from "@/components/ask/ask-ai-workspace";
import { TextEntryWorkspace } from "@/components/entry/text-entry-workspace";
import { ReminderWorkspace } from "@/components/reminders/reminder-workspace";
import { DashboardSummaryPanel } from "@/components/summary/dashboard-summary-panel";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await ensureAppProfile(user);
  const [summary, reminders] = await Promise.all([
    getDashboardSummary(user.id, profile.timezone),
    getReminderBoard(user.id, profile.timezone),
  ]);

  return (
    <section className="grid gap-5">
      <div className="shell-card rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-brand">Dashboard</p>
            <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950 sm:text-4xl">
              Hello, {profile.displayName ?? "there"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Quick entry stays first. Everything else is visible below in a simpler
              layout with optional sections when you need them.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="soft-card rounded-[1.4rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Today
              </p>
              <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
                {formatCurrency(summary.today.netCashMovement)}
              </p>
            </div>
            <div className="soft-card rounded-[1.4rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                This week
              </p>
              <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
                {formatCurrency(summary.week.netCashMovement)}
              </p>
            </div>
            <div className="soft-card rounded-[1.4rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Active reminders
              </p>
              <p className="mt-3 font-mono text-2xl font-semibold text-slate-950">
                {reminders.counts.active}
              </p>
            </div>
          </div>
        </div>
      </div>

      <TextEntryWorkspace timezone={profile.timezone} defaultBucket="personal" />

      <DashboardSummaryPanel summary={summary} />

      <ReminderWorkspace
        board={reminders}
        timezone={profile.timezone}
        defaultBucket="personal"
        variant="dashboard"
      />

      <details className="soft-card rounded-[1.8rem] p-5 sm:p-6">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
          Show Ask AI
        </summary>
        <div className="mt-5">
          <AskAiWorkspace timezone={profile.timezone} />
        </div>
      </details>
    </section>
  );
}
