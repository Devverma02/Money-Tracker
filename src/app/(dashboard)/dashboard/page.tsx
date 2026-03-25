import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getRecentEntries } from "@/lib/ledger/history";
import { getRecurringSuggestions } from "@/lib/recurring/recurring-suggestions";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { getUserSettings } from "@/lib/settings/settings";
import { settingsResponseSchema } from "@/lib/settings/settings-contract";
import { getSetupState } from "@/lib/setup/setup";
import { setupResponseSchema } from "@/lib/setup/setup-contract";
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
  await ensureAppProfile(user);
  const settings = await getUserSettings(user.id);
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

  const [summary, reminders, historyPageData, recurringSuggestions, setupState] = await Promise.all([
    getDashboardSummary(
      user.id,
      settings.timezone,
      settings.preferredCurrency ?? "INR",
    ),
    getReminderBoard(user.id, settings.timezone),
    getRecentEntries(user.id, settings.timezone, {
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
    getRecurringSuggestions(user.id, settings.timezone),
    getSetupState(user.id),
  ]);

  return (
    <DashboardWorkspace
      timezone={settings.timezone}
      settings={settingsResponseSchema.parse(settings)}
      setupState={setupResponseSchema.parse(setupState)}
      summary={summary}
      reminders={reminders}
      historyPageData={historyPageData}
      recurringSuggestions={recurringSuggestions}
      initialSection={activeSection}
    />
  );
}
