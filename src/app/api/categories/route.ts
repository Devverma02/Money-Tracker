import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listCategoryGroups,
  mergeCategoryIntoCanonical,
} from "@/lib/categories/category-aliases";

const mergeCategorySchema = z.object({
  sourceCategory: z.string().trim().min(1).max(80),
  targetCategory: z.string().trim().min(1).max(80),
});

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ groups: await listCategoryGroups(user.id) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The category list could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = (await request.json()) as unknown;
    const payload = mergeCategorySchema.parse(json);
    return NextResponse.json(await mergeCategoryIntoCanonical({ userId: user.id, ...payload }));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The category merge could not be saved." },
      { status: 500 },
    );
  }
}
