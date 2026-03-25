import { NextResponse } from "next/server";
import { ensureAppProfile } from "@/lib/bootstrap-profile";
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

  const profile = await ensureAppProfile(user);
  const summary = await getDashboardSummary(
    user.id,
    profile.timezone,
    profile.preferredCurrency ?? "INR",
  );
  return NextResponse.json(summary);
}
