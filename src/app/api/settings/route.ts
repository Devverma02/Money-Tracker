import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  settingsResponseSchema,
  updateSettingsRequestSchema,
} from "@/lib/settings/settings-contract";
import { getUserSettings, updateUserSettings } from "@/lib/settings/settings";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getUserSettings(user.id);
    return NextResponse.json(settingsResponseSchema.parse(settings));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The settings could not be loaded." },
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
    const payload = updateSettingsRequestSchema.parse(json);
    const settings = await updateUserSettings(user.id, payload);

    return NextResponse.json(settingsResponseSchema.parse(settings));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The settings could not be updated." },
      { status: 500 },
    );
  }
}
