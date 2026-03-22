import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type CategoryGroup = {
  canonicalName: string;
  aliases: string[];
  entryCount: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCategoryName(value: string) {
  return normalizeWhitespace(value)
    .replace(/[()[\],.]+/g, " ")
    .trim()
    .toLowerCase();
}

function toTitleLike(value: string) {
  return normalizeWhitespace(value)
    .split(" ")
    .map((part) => {
      if (!part) {
        return part;
      }

      if (/[^\u0000-\u007f]/.test(part)) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function getCategoryClient(tx?: Prisma.TransactionClient) {
  return tx ?? prisma;
}

async function resolveCanonicalCategoryRow(
  userId: string,
  rawCategory: string,
  tx?: Prisma.TransactionClient,
) {
  const normalized = normalizeCategoryName(rawCategory);

  if (!normalized) {
    return null;
  }

  return getCategoryClient(tx).categoryAlias.findFirst({
    where: {
      userId,
      OR: [
        {
          normalizedAlias: normalized,
        },
        {
          normalizedCanonicalName: normalized,
        },
      ],
    },
    orderBy: {
      canonicalName: "asc",
    },
  });
}

export async function resolveCategoryName(
  userId: string,
  rawCategory: string | null | undefined,
  tx?: Prisma.TransactionClient,
) {
  if (!rawCategory) {
    return null;
  }

  const cleanCategory = normalizeWhitespace(rawCategory);

  if (!cleanCategory) {
    return null;
  }

  const existing = await resolveCanonicalCategoryRow(userId, cleanCategory, tx);
  if (existing) {
    return existing.canonicalName;
  }

  return toTitleLike(cleanCategory);
}

export async function listCategoryGroups(userId: string): Promise<CategoryGroup[]> {
  const [entries, aliasRows] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: {
        userId,
        category: {
          not: null,
        },
      },
      select: {
        category: true,
      },
    }),
    prisma.categoryAlias.findMany({
      where: {
        userId,
      },
      select: {
        canonicalName: true,
        alias: true,
      },
      orderBy: [
        {
          canonicalName: "asc",
        },
        {
          alias: "asc",
        },
      ],
    }),
  ]);

  const groups = new Map<
    string,
    {
      canonicalName: string;
      aliases: Set<string>;
      entryCount: number;
    }
  >();

  for (const row of aliasRows) {
    const key = normalizeCategoryName(row.canonicalName);
    const existing = groups.get(key) ?? {
      canonicalName: row.canonicalName,
      aliases: new Set<string>(),
      entryCount: 0,
    };

    if (normalizeCategoryName(row.alias) !== key) {
      existing.aliases.add(row.alias);
    }

    groups.set(key, existing);
  }

  for (const entry of entries) {
    const rawCategory = entry.category?.trim();
    if (!rawCategory) {
      continue;
    }

    const existingAlias = aliasRows.find(
      (row) => normalizeCategoryName(row.alias) === normalizeCategoryName(rawCategory),
    );
    const canonicalName = existingAlias?.canonicalName ?? rawCategory;
    const key = normalizeCategoryName(canonicalName);
    const existing = groups.get(key) ?? {
      canonicalName,
      aliases: new Set<string>(),
      entryCount: 0,
    };

    existing.entryCount += 1;

    if (normalizeCategoryName(rawCategory) !== key) {
      existing.aliases.add(rawCategory);
    }

    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      canonicalName: group.canonicalName,
      aliases: Array.from(group.aliases).sort((left, right) => left.localeCompare(right)),
      entryCount: group.entryCount,
    }))
    .sort((left, right) => right.entryCount - left.entryCount || left.canonicalName.localeCompare(right.canonicalName));
}

export async function mergeCategoryIntoCanonical(params: {
  userId: string;
  sourceCategory: string;
  targetCategory: string;
}) {
  const sourceCategory = normalizeWhitespace(params.sourceCategory);
  const targetCategory = normalizeWhitespace(params.targetCategory);

  if (!sourceCategory || !targetCategory) {
    throw new Error("Both source and target categories are required.");
  }

  const sourceResolved = await resolveCanonicalCategoryRow(params.userId, sourceCategory);
  const targetResolved = await resolveCanonicalCategoryRow(params.userId, targetCategory);

  const canonicalSource = sourceResolved?.canonicalName ?? toTitleLike(sourceCategory);
  const canonicalTarget = targetResolved?.canonicalName ?? toTitleLike(targetCategory);

  if (normalizeCategoryName(canonicalSource) === normalizeCategoryName(canonicalTarget)) {
    return {
      ok: true as const,
      message: "Both categories already point to the same canonical category.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.updateMany({
      where: {
        userId: params.userId,
        category: {
          in: [canonicalSource, sourceCategory],
        },
      },
      data: {
        category: canonicalTarget,
      },
    });

    const sourceAliasRows = await tx.categoryAlias.findMany({
      where: {
        userId: params.userId,
        OR: [
          {
            normalizedCanonicalName: normalizeCategoryName(canonicalSource),
          },
          {
            normalizedAlias: normalizeCategoryName(sourceCategory),
          },
        ],
      },
      select: {
        alias: true,
      },
    });

    const aliasesToCarry = Array.from(
      new Set([canonicalSource, sourceCategory, ...sourceAliasRows.map((row) => row.alias)]),
    );

    await tx.categoryAlias.deleteMany({
      where: {
        userId: params.userId,
        OR: [
          {
            normalizedCanonicalName: normalizeCategoryName(canonicalSource),
          },
          {
            normalizedAlias: {
              in: aliasesToCarry.map((alias) => normalizeCategoryName(alias)),
            },
          },
        ],
      },
    });

    for (const alias of aliasesToCarry) {
      const normalizedAlias = normalizeCategoryName(alias);
      if (!normalizedAlias || normalizedAlias === normalizeCategoryName(canonicalTarget)) {
        continue;
      }

      await tx.categoryAlias.upsert({
        where: {
          userId_normalizedAlias: {
            userId: params.userId,
            normalizedAlias,
          },
        },
        update: {
          canonicalName: canonicalTarget,
          normalizedCanonicalName: normalizeCategoryName(canonicalTarget),
          alias,
        },
        create: {
          userId: params.userId,
          canonicalName: canonicalTarget,
          normalizedCanonicalName: normalizeCategoryName(canonicalTarget),
          alias,
          normalizedAlias,
        },
      });
    }
  });

  return {
    ok: true as const,
    message: `${sourceCategory} is now merged into ${targetCategory}.`,
  };
}
