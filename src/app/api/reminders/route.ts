import { NextResponse } from "next/server";
import { createReminderRequestSchema, createReminderResponseSchema } from "@/lib/reminders/reminder-contract";
import { createReminder } from "@/lib/reminders/create-reminder";
import { getReminderBoard } from "@/lib/reminders/reminder-board";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get("timezone") ?? "Asia/Kolkata";
  const board = await getReminderBoard(user.id, timezone);

  return NextResponse.json(board);
}

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
    const payload = createReminderRequestSchema.parse(json);
    const result = await createReminder({
      user,
      payload,
    });

    return NextResponse.json(createReminderResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The reminder could not be saved." },
      { status: 500 },
    );
  }
}
