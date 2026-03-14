import { NextResponse } from "next/server";
import { reminderMutationResponseSchema, snoozeReminderRequestSchema } from "@/lib/reminders/reminder-contract";
import { snoozeReminder } from "@/lib/reminders/update-reminder-state";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    reminderId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reminderId } = await context.params;
    const json = (await request.json()) as unknown;
    const payload = snoozeReminderRequestSchema.parse(json);
    const result = await snoozeReminder(reminderId, user.id, payload.snoozeUntil);

    return NextResponse.json(reminderMutationResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The reminder could not be snoozed." },
      { status: 500 },
    );
  }
}
