import { HistoryWorkspace } from "@/components/history/history-workspace";
import { getRecentEntries } from "@/lib/ledger/history";
import { createClient } from "@/lib/supabase/server";

type HistoryPageProps = {
  searchParams?: Promise<{
    page?: string;
    type?: string;
    period?: string;
  }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const historyPageData = await getRecentEntries(user.id, {
    page: Number(params.page ?? "1"),
    entryType: params.type ?? "",
    period:
      params.period === "today" ||
      params.period === "week" ||
      params.period === "month"
        ? params.period
        : "all",
  });

  return <HistoryWorkspace historyPageData={historyPageData} />;
}
