import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushSubscriptionRequestSchema } from "@/lib/push/push-contract";
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
    const payload = pushSubscriptionRequestSchema.parse(json);

    await prisma.pushSubscription.upsert({
      where: {
        endpoint: payload.endpoint,
      },
      update: {
        userId: user.id,
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        expiresAt:
          payload.expirationTime === null || payload.expirationTime === undefined
            ? null
            : new Date(payload.expirationTime),
      },
      create: {
        userId: user.id,
        endpoint: payload.endpoint,
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        expiresAt:
          payload.expirationTime === null || payload.expirationTime === undefined
            ? null
            : new Date(payload.expirationTime),
      },
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The push subscription could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = (await request.json()) as unknown;
    const payload = pushSubscriptionRequestSchema.parse(json);

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: payload.endpoint,
      },
    });

    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The push subscription could not be removed." },
      { status: 500 },
    );
  }
}
