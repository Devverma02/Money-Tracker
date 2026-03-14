import { NextResponse } from "next/server";
import { parseMoneyInput } from "@/lib/ai/parse-money-input";
import { parseRequestSchema } from "@/lib/ai/parse-contract";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await request.json()) as unknown;
  const payload = parseRequestSchema.parse(json);
  const result = await parseMoneyInput(payload);

  return NextResponse.json(result);
}
