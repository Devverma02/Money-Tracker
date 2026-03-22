import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveEntryResponseSchema, saveEntryRequestSchema } from "@/lib/ledger/save-contract";
import { saveParsedEntries } from "@/lib/ledger/save-entry";
import { PersonAmbiguityError } from "@/lib/persons/person-resolution";

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
    const payload = saveEntryRequestSchema.parse(json);
    const actions = payload.actions ?? (payload.action ? [payload.action] : []);

    if (actions.length === 0) {
      return NextResponse.json(
        {
          error: "At least one reviewed entry is required before saving.",
        },
        { status: 400 },
      );
    }

    const unclearAction = actions.find(
      (action) =>
        !action.entryType ||
        !action.resolvedDate ||
        (action.amount === null && action.entryType !== "note"),
    );

    if (unclearAction) {
      return NextResponse.json(
        {
          error: "One of the selected entries still needs clarification before it can be saved.",
        },
        { status: 400 },
      );
    }

    const result = await saveParsedEntries({
      user,
      actions,
      parserConfidence: payload.parserConfidence,
    });

    return NextResponse.json(saveEntryResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof PersonAmbiguityError) {
      return NextResponse.json(
        {
          saved: false,
          errorCode: "person_ambiguity",
          message: error.message,
          conflicts: error.conflicts,
        },
        { status: 409 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The entry could not be saved." },
      { status: 500 },
    );
  }
}
