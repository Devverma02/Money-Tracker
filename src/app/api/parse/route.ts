import { NextResponse } from "next/server";
import { loadAiCandidateContext } from "@/lib/ai/candidate-context";
import { parseMoneyInput } from "@/lib/ai/parse-money-input";
import { parseRequestSchema } from "@/lib/ai/parse-contract";
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
    const payload = parseRequestSchema.parse({
      ...((json as Record<string, unknown>) ?? {}),
      knownPeople: candidateContext.knownPeople,
      knownCategories: candidateContext.knownCategories,
    });
    const result = await parseMoneyInput(payload);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The parser is not available right now." },
      { status: 500 },
    );
  }
}
