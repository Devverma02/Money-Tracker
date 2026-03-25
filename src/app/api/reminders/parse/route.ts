import { NextResponse } from "next/server";
import { loadAiCandidateContext } from "@/lib/ai/candidate-context";
import { parseReminderInput } from "@/lib/reminders/parse-reminder-input";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = (await request.json()) as unknown;
    const candidateContext = await loadAiCandidateContext(user.id);
    const result = await parseReminderInput({
      ...((json as Record<string, unknown>) ?? {}),
      knownPeople: candidateContext.knownPeople,
      knownCategories: candidateContext.knownCategories,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The reminder could not be understood." },
      { status: 500 },
    );
  }
}
