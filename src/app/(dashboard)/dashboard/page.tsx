import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { createClient } from "@/lib/supabase/server";

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
    <DashboardWorkspace
      displayName={profile.displayName}
      timezone={profile.timezone}
      summary={summary}
      reminders={reminders}
    />
  );
}
