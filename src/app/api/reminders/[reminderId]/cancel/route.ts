import { NextResponse } from "next/server";
import { reminderMutationResponseSchema } from "@/lib/reminders/reminder-contract";
import { cancelReminder } from "@/lib/reminders/update-reminder-state";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    reminderId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reminderId } = await context.params;
    const result = await cancelReminder(reminderId, user.id);

    return NextResponse.json(reminderMutationResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The reminder could not be cancelled." },
      { status: 500 },
    );
  }
}
