import { HistoryWorkspace } from "@/components/history/history-workspace";
import { getRecentEntries } from "@/lib/ledger/history";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const entries = await getRecentEntries(user.id);

  return <HistoryWorkspace entries={entries} />;
}
