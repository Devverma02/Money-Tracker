import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  correctionResponseSchema,
  correctEntryRequestSchema,
} from "@/lib/ledger/correction-contract";
import { correctEntry } from "@/lib/ledger/correct-entry";

export async function POST(
  request: Request,
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
    const json = (await request.json()) as unknown;
    const payload = correctEntryRequestSchema.parse(json);
    const result = await correctEntry({
      userId: user.id,
      entryId,
      changes: payload,
    });

    return NextResponse.json(correctionResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The correction could not be applied." },
      { status: 500 },
    );
  }
}
