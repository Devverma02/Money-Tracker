import { NextResponse } from "next/server";
import { answerAskAiQuestion } from "@/lib/ai/ask-answer";
import { askAiRequestSchema } from "@/lib/ai/ask-contract";
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
    const payload = askAiRequestSchema.parse(json);
    const result = await answerAskAiQuestion({
      userId: user.id,
      question: payload.question,
      timeZone: payload.timezone,
      replyLanguage: payload.replyLanguage,
      conversation: payload.conversation,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Ask AI failed." }, { status: 500 });
  }
}
