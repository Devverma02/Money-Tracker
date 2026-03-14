import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctionResponseSchema } from "@/lib/ledger/correction-contract";
import { undoLastCorrection } from "@/lib/ledger/correct-entry";

export async function POST(
  _request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { entryId } = await context.params;
    const result = await undoLastCorrection({
      userId: user.id,
      entryId,
    });

    return NextResponse.json(correctionResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The undo action could not be applied." },
      { status: 500 },
    );
  }
}
