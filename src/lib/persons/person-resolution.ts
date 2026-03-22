import type { Prisma } from "@prisma/client";
import type { ParsedAction } from "@/lib/ai/parse-contract";

export type PersonCandidate = {
  id: string;
  displayName: string;
};

export type PersonConflict = {
  actionIndex: number;
  inputName: string;
  candidates: PersonCandidate[];
};

export class PersonAmbiguityError extends Error {
  constructor(public readonly conflicts: PersonConflict[]) {
    super("Multiple people match the same name. Please choose the right person.");
    this.name = "PersonAmbiguityError";
  }
}

type PersonClientTx = Prisma.TransactionClient & {
  person: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    findFirst: (args: unknown) => Promise<unknown>;
  };
  personAlias: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  if (/[^\u0000-\u007f]/.test(value)) {
    return normalizeWhitespace(value);
  }

  return normalizeWhitespace(value)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizePersonLookup(value: string) {
  const withoutHonorifics = value
    .replace(
      /\b(ji|bhai|sir|madam|didi|bhabhi|uncle|aunty|chacha|mama|bhaiya|behen)\b/gi,
      " ",
    )
    .replace(/[()[\],.]+/g, " ");

  return normalizeWhitespace(withoutHonorifics).toLowerCase();
}

function buildAliasList(rawName: string, displayName: string) {
  return Array.from(
    new Set(
      [rawName, displayName]
        .map((value) => normalizeWhitespace(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function getNameTokens(value: string) {
  return normalizePersonLookup(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isShortLongNameVariant(left: string, right: string) {
  const leftTokens = getNameTokens(left);
  const rightTokens = getNameTokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length > rightTokens.length ? leftTokens : rightTokens;

  if (shorter.length === longer.length) {
    return false;
  }

  return shorter.every((token, index) => longer[index] === token);
}

async function ensurePersonAliases(
  tx: Prisma.TransactionClient,
  personId: string,
  aliases: string[],
) {
  const personTx = tx as PersonClientTx;

  for (const alias of aliases) {
    const normalizedAlias = normalizePersonLookup(alias);
    if (!normalizedAlias) {
      continue;
    }

    await personTx.personAlias.upsert({
      where: {
        personId_normalizedAlias: {
          personId,
          normalizedAlias,
        },
      },
      update: {},
      create: {
        personId,
        alias,
        normalizedAlias,
      },
    });
  }
}

async function createPersonRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  rawName: string,
  displayName: string,
) {
  const personTx = tx as PersonClientTx;
  const aliases = buildAliasList(rawName, displayName);

  return personTx.person.create({
    data: {
      userId,
      displayName,
      normalizedDisplayName: normalizePersonLookup(displayName),
      aliases: {
        create: aliases.map((alias) => ({
          alias,
          normalizedAlias: normalizePersonLookup(alias),
        })),
      },
    },
    select: {
      id: true,
      displayName: true,
    },
  });
}

async function findMatchingPeople(
  tx: Prisma.TransactionClient,
  userId: string,
  rawName: string,
) {
  const personTx = tx as PersonClientTx;
  const normalizedName = normalizePersonLookup(rawName);

  if (!normalizedName) {
    return [];
  }

  const matches = await personTx.person.findMany({
    where: {
      userId,
      OR: [
        {
          normalizedDisplayName: normalizedName,
        },
        {
          aliases: {
            some: {
              normalizedAlias: normalizedName,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      displayName: true,
    },
    orderBy: {
      displayName: "asc",
    },
  });

  return Array.from(new Map(matches.map((match: PersonCandidate) => [match.id, match])).values());
}

async function findVariantPeople(
  tx: Prisma.TransactionClient,
  userId: string,
  rawName: string,
) {
  const personTx = tx as PersonClientTx;
  const normalizedName = normalizePersonLookup(rawName);

  if (!normalizedName) {
    return [];
  }

  const people = await personTx.person.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      displayName: true,
      aliases: {
        select: {
          alias: true,
        },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  const matches = people.filter((person) => {
    const namesToCompare = [
      person.displayName,
      ...person.aliases.map((alias) => alias.alias),
    ];

    return namesToCompare.some((name) => isShortLongNameVariant(name, rawName));
  });

  return Array.from(
    new Map(
      matches.map((match) => [
        match.id,
        {
          id: match.id,
          displayName: match.displayName,
        } satisfies PersonCandidate,
      ]),
    ).values(),
  );
}

async function resolvePersonName(
  tx: Prisma.TransactionClient,
  userId: string,
  action: ParsedAction,
  actionIndex: number,
) {
  const rawName = normalizeWhitespace(action.personName ?? "");

  if (!rawName) {
    return null;
  }

  if (action.resolvedPersonId) {
    const existingPerson = await (tx as PersonClientTx).person.findFirst({
      where: {
        id: action.resolvedPersonId,
        userId,
      },
      select: {
        displayName: true,
      },
    });

    if (!existingPerson) {
      throw new Error("The selected person could not be found anymore. Please choose again.");
    }

    await ensurePersonAliases(tx, action.resolvedPersonId, buildAliasList(rawName, existingPerson.displayName));
    return existingPerson.displayName;
  }

  if (action.createPersonLabel) {
    const displayName = toTitleCase(action.createPersonLabel);
    const normalizedDisplayName = normalizePersonLookup(displayName);

    const existingByLabel = await (tx as PersonClientTx).person.findFirst({
      where: {
        userId,
        normalizedDisplayName,
      },
      select: {
        displayName: true,
      },
    });

    if (existingByLabel) {
      return existingByLabel.displayName;
    }

    const createdPerson = await createPersonRecord(tx, userId, rawName, displayName);
    return createdPerson.displayName;
  }

  const matches = await findMatchingPeople(tx, userId, rawName);

  if (matches.length === 0) {
    const variantMatches = await findVariantPeople(tx, userId, rawName);

    if (variantMatches.length === 1) {
      await ensurePersonAliases(
        tx,
        variantMatches[0].id,
        buildAliasList(rawName, variantMatches[0].displayName),
      );
      return variantMatches[0].displayName;
    }

    if (variantMatches.length > 1) {
      throw new PersonAmbiguityError([
        {
          actionIndex,
          inputName: rawName,
          candidates: variantMatches,
        },
      ]);
    }

    const displayName = toTitleCase(rawName);
    const createdPerson = await createPersonRecord(tx, userId, rawName, displayName);
    return createdPerson.displayName;
  }

  if (matches.length === 1) {
    await ensurePersonAliases(tx, matches[0].id, buildAliasList(rawName, matches[0].displayName));
    return matches[0].displayName;
  }

  throw new PersonAmbiguityError([
    {
      actionIndex,
      inputName: rawName,
      candidates: matches,
    },
  ]);
}

export async function resolvePersonNameForAction(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  action: ParsedAction;
  actionIndex: number;
}) {
  const { tx, userId, action, actionIndex } = params;
  return resolvePersonName(tx, userId, action, actionIndex);
}
