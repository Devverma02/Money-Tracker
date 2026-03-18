import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getRecentEntries } from "@/lib/ledger/history";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams?: Promise<{
    section?: string;
    page?: string;
    type?: string;
    period?: string;
  }>;
};

const allowedSections = new Set([
  "overview",
  "entry",
  "reminders",
  "history",
  "ask-ai",
] as const);

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const profile = await ensureAppProfile(user);
  const activeSection =
    params.section && allowedSections.has(params.section as never)
      ? (params.section as
          | "overview"
          | "entry"
          | "reminders"
          | "history"
          | "ask-ai")
      : "overview";

  const [summary, reminders, historyPageData] = await Promise.all([
    getDashboardSummary(user.id, profile.timezone),
    getReminderBoard(user.id, profile.timezone),
    getRecentEntries(user.id, profile.timezone, {
      page: Number(params.page ?? "1"),
      entryType: params.type ?? "",
      period:
        params.period === "today" ||
        params.period === "week" ||
        params.period === "month"
          ? params.period
          : "all",
    }),
  ]);

  return (
    <DashboardWorkspace
      timezone={profile.timezone}
      summary={summary}
      reminders={reminders}
      historyPageData={historyPageData}
      initialSection={activeSection}
    />
  );
}
