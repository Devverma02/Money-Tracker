import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (serverEnv.STT_PROVIDER !== "openai") {
    return NextResponse.json(
      { error: "OpenAI transcription is not enabled for this app." },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio");
  const locale = formData.get("locale");

  if (!(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "Audio file is required for transcription." },
      { status: 400 },
    );
  }

  if (audioFile.size === 0 || audioFile.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio recording is missing or too large." },
      { status: 400 },
    );
  }

  const openAiFormData = new FormData();
  openAiFormData.append("file", audioFile, audioFile.name || "speech.webm");
  openAiFormData.append("model", "gpt-4o-mini-transcribe");
  openAiFormData.append("response_format", "text");
  openAiFormData.append(
    "prompt",
    "Transcribe Hindi, Hinglish, and English speech accurately. Preserve names, rupee amounts, and money-related words.",
  );

  if (typeof locale === "string" && locale.toLowerCase().startsWith("hi")) {
    openAiFormData.append("language", "hi");
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: openAiFormData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    return NextResponse.json(
      {
        error: `Transcription failed: ${response.status} ${errorText}`,
      },
      { status: 500 },
    );
  }

  const transcriptText = (await response.text()).trim();

  if (!transcriptText) {
    return NextResponse.json(
      { error: "OpenAI transcription returned empty text." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    text: transcriptText,
  });
}
