import { ReminderWorkspace } from "@/components/reminders/reminder-workspace";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { createClient } from "@/lib/supabase/server";

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await ensureAppProfile(user);
  const reminders = await getReminderBoard(user.id, profile.timezone);

  return (
    <ReminderWorkspace
      board={reminders}
      timezone={profile.timezone}
      defaultBucket="personal"
      variant="page"
    />
  );
}
