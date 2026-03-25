import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getRecentEntries } from "@/lib/ledger/history";
import { getRecurringSuggestions } from "@/lib/recurring/recurring-suggestions";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { settingsResponseSchema } from "@/lib/settings/settings-contract";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams?: Promise<{
    section?: string;
    page?: string;
    type?: string;
    period?: string;
    search?: string;
  }>;
};

const allowedSections = new Set([
  "overview",
  "entry",
  "reminders",
  "history",
  "persons",
  "ask-ai",
  "settings",
] as const);

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
          | "persons"
          | "ask-ai"
          | "settings")
      : "overview";

  const [summary, reminders, historyPageData, recurringSuggestions] = await Promise.all([
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
      search: params.search ?? "",
    }),
    getRecurringSuggestions(user.id, profile.timezone),
  ]);

  return (
    <DashboardWorkspace
      timezone={profile.timezone}
      settings={settingsResponseSchema.parse({
        displayName: profile.displayName ?? "",
        email: profile.email ?? null,
        preferredLanguage: profile.preferredLanguage ?? "HINGLISH",
        timezone: profile.timezone ?? "Asia/Kolkata",
        preferredCurrency: profile.preferredCurrency ?? "INR",
        voiceRepliesEnabled: profile.voiceRepliesEnabled ?? true,
        reminderDefaultTime: profile.reminderDefaultTime ?? "09:00",
        preferredEntryInput: profile.preferredEntryInput ?? "TYPING",
      })}
      summary={summary}
      reminders={reminders}
      historyPageData={historyPageData}
      recurringSuggestions={recurringSuggestions}
      initialSection={activeSection}
    />
  );
}
