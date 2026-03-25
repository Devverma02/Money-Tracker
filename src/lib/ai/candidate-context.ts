import { prisma } from "@/lib/prisma";

export type AiCandidateContext = {
  knownPeople: string[];
  knownCategories: string[];
};

export async function loadAiCandidateContext(userId: string): Promise<AiCandidateContext> {
  const [people, personAliases, entryCategories, categoryAliases] = await Promise.all([
    prisma.person.findMany({
      where: {
        userId,
      },
      select: {
        displayName: true,
      },
      take: 120,
      orderBy: {
        displayName: "asc",
      },
    }),
    prisma.personAlias.findMany({
      where: {
        person: {
          userId,
        },
      },
      select: {
        alias: true,
      },
      take: 160,
      orderBy: {
        alias: "asc",
      },
    }),
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
      distinct: ["category"],
      take: 120,
    }),
    prisma.categoryAlias.findMany({
      where: {
        userId,
      },
      select: {
        canonicalName: true,
        alias: true,
      },
      take: 160,
      orderBy: {
        canonicalName: "asc",
      },
    }),
  ]);

  const knownPeople = Array.from(
    new Set(
      [
        ...people.map((person) => person.displayName),
        ...personAliases.map((alias) => alias.alias),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 120);

  const knownCategories = Array.from(
    new Set(
      [
        ...entryCategories.map((entry) => entry.category ?? ""),
        ...categoryAliases.flatMap((alias) => [alias.canonicalName, alias.alias]),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 120);

  return {
    knownPeople,
    knownCategories,
  };
}
