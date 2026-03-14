import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

const realtimeSessionConfig = {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio"],
    instructions:
      "You are MoneyManage, a trust-first voice money assistant. Speak in very short, natural Hinglish or simple English. Keep most replies under two short sentences. Prioritize speed and clarity. If the user mentions a transaction, reminder, or money update, briefly repeat what you heard and tell them to review the on-screen preview before anything can be saved. Never claim money was saved unless the app confirms it.",
    audio: {
      input: {
        noise_reduction: {
          type: "near_field",
        },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "hi",
        },
        turn_detection: {
          type: "server_vad",
          create_response: true,
          interrupt_response: true,
          silence_duration_ms: 350,
          prefix_padding_ms: 180,
        },
      },
      output: {
        voice: "marin",
        speed: 1.08,
      },
    },
  },
} as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(realtimeSessionConfig),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return NextResponse.json(
      {
        error: `Realtime token request failed: ${response.status} ${errorText}`,
      },
      { status: 500 },
    );
  }

  const payload = (await response.json()) as {
    client_secret?: {
      value?: string;
      expires_at?: number;
    };
  };
  const clientSecret = payload.client_secret?.value;

  if (!clientSecret) {
    return NextResponse.json(
      { error: "Realtime token response did not include a client secret." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    clientSecret,
    expiresAt: payload.client_secret?.expires_at ?? null,
  });
}
