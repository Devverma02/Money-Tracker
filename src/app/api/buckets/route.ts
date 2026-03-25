import { BucketKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function slugifyBucketName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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
    const json = (await request.json()) as { name?: string };
    const name = json.name?.trim() ?? "";

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Bucket name should be at least 2 letters long." },
        { status: 400 },
      );
    }

    const baseSlug = slugifyBucketName(name);

    if (!baseSlug) {
      return NextResponse.json(
        { error: "Bucket name could not be converted into a valid bucket." },
        { status: 400 },
      );
    }

    let slug = baseSlug;
    let counter = 2;

    while (
      await prisma.bucket.findFirst({
        where: {
          userId: user.id,
          slug,
        },
        select: {
          id: true,
        },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const bucket = await prisma.bucket.create({
      data: {
        userId: user.id,
        name,
        slug,
        kind: BucketKind.CUSTOM,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
      },
    });

    return NextResponse.json({
      ok: true,
      bucket,
      message: `${name} bucket created.`,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The bucket could not be created." },
      { status: 500 },
    );
  }
}
