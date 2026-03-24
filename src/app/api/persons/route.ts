import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addPersonAlias,
  getPersonDetail,
  getPersonList,
  getPersonMergeSuggestions,
  renamePerson,
} from "@/lib/persons/person-book";

const addAliasSchema = z.object({
  personId: z.string().uuid(),
  alias: z.string().trim().min(1).max(80),
});

const renamePersonSchema = z.object({
  personId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
});

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const personId = url.searchParams.get("personId");

  try {
    if (personId) {
      return NextResponse.json(await getPersonDetail(user.id, personId));
    }

    const [persons, mergeSuggestions] = await Promise.all([
      getPersonList(user.id),
      getPersonMergeSuggestions(user.id),
    ]);

    return NextResponse.json({ persons, mergeSuggestions });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Could not load person data." },
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
    const payload = addAliasSchema.parse(json);
    return NextResponse.json(await addPersonAlias({ userId: user.id, ...payload }));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The alias could not be saved." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = (await request.json()) as unknown;
    const payload = renamePersonSchema.parse(json);
    return NextResponse.json(await renamePerson({ userId: user.id, ...payload }));
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The person name could not be updated." },
      { status: 500 },
    );
  }
}
