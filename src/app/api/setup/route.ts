import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  setupResponseSchema,
  updateSetupRequestSchema,
} from "@/lib/setup/setup-contract";
import { getSetupState, updateSetupState } from "@/lib/setup/setup";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setup = await getSetupState(user.id);
    return NextResponse.json(setupResponseSchema.parse(setup));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The starting setup could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = (await request.json()) as unknown;
    const payload = updateSetupRequestSchema.parse(json);
    const setup = await updateSetupState(user.id, payload);

    return NextResponse.json(setupResponseSchema.parse(setup));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The starting setup could not be updated." },
      { status: 500 },
    );
  }
}
