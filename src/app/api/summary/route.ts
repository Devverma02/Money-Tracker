import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/summaries/dashboard-summary";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDashboardSummary(user.id, "Asia/Kolkata");
  return NextResponse.json(summary);
}
