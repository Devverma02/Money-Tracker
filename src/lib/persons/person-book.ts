import { EntryType } from "@prisma/client";
import { prisma as prismaClient } from "@/lib/prisma";
import { getOpeningLoanPositions } from "@/lib/setup/setup";
import {
  isShortLongNameVariant,
  normalizePersonLookup,
} from "@/lib/persons/person-resolution";

export type PersonSummary = {
  personId: string;
  personName: string;
  aliases: string[];
  totalGiven: number;
  totalReceivedBack: number;
  totalTaken: number;
  totalRepaid: number;
  netReceivable: number;
  netPayable: number;
  transactionCount: number;
  lastTransactionDate: string;
};

export type PersonTransaction = {
  id: string;
  amount: number;
  entryType: string;
  category: string | null;
  note: string | null;
  entryDate: string;
  sourceText: string | null;
  createdAt: string;
};

export type PersonDetail = {
  personId: string;
  personName: string;
  aliases: string[];
  summary: {
    totalGiven: number;
    totalReceivedBack: number;
    totalTaken: number;
    totalRepaid: number;
    otherAmount: number;
    netReceivable: number;
    netPayable: number;
    transactionCount: number;
  };
  transactions: PersonTransaction[];
};

export type PersonMergeSuggestion = {
  sourcePersonId: string;
  sourcePersonName: string;
  targetPersonId: string;
  targetPersonName: string;
  reason: string;
};

type PersonRecord = {
  id: string;
  displayName: string;
  aliases: string[];
};

function buildNameSet(person: PersonRecord) {
  return new Set(
    [person.displayName, ...person.aliases]
      .map((value) => normalizePersonLookup(value))
      .filter(Boolean),
  );
}

async function loadPeople(userId: string) {
  const people = await prismaClient.person.findMany({
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
        orderBy: {
          alias: "asc",
        },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  return people.map((person) => ({
    id: person.id,
    displayName: person.displayName,
    aliases: person.aliases.map((alias) => alias.alias),
  })) satisfies PersonRecord[];
}

async function loadEntriesByName(userId: string) {
  const entries = await prismaClient.ledgerEntry.findMany({
    where: {
      userId,
      personName: {
        not: null,
      },
    },
    select: {
      id: true,
      amount: true,
      entryType: true,
      category: true,
      note: true,
      entryDate: true,
      sourceText: true,
      createdAt: true,
      personName: true,
    },
    orderBy: {
      entryDate: "desc",
    },
  });

  return entries;
}

async function loadOpeningLoanPositions(userId: string) {
  const positions = await getOpeningLoanPositions(userId);
  return positions.map((item) => ({
    id: item.id,
    personName: item.personName,
    normalizedPersonName: item.normalizedPersonName,
    direction: item.direction,
    amount: item.amount.toNumber(),
    createdAt: item.createdAt,
  }));
}

function mapEntriesToPeople(people: PersonRecord[], entries: Awaited<ReturnType<typeof loadEntriesByName>>) {
  const normalizedToPerson = new Map<string, PersonRecord>();

  for (const person of people) {
    for (const name of buildNameSet(person)) {
      normalizedToPerson.set(name, person);
    }
  }

  const grouped = new Map<string, typeof entries>();

  for (const entry of entries) {
    const normalizedName = normalizePersonLookup(entry.personName ?? "");
    const person = normalizedToPerson.get(normalizedName);

    if (!person) {
      continue;
    }

    const current = grouped.get(person.id) ?? [];
    current.push(entry);
    grouped.set(person.id, current);
  }

  return grouped;
}

function mapOpeningPositionsToPeople(
  people: PersonRecord[],
  positions: Awaited<ReturnType<typeof loadOpeningLoanPositions>>,
) {
  const normalizedToPerson = new Map<string, PersonRecord>();

  for (const person of people) {
    for (const name of buildNameSet(person)) {
      normalizedToPerson.set(name, person);
    }
  }

  const grouped = new Map<string, typeof positions>();

  for (const item of positions) {
    const person = normalizedToPerson.get(item.normalizedPersonName);

    if (!person) {
      continue;
    }

    const current = grouped.get(person.id) ?? [];
    current.push(item);
    grouped.set(person.id, current);
  }

  return grouped;
}

export async function getPersonList(userId: string) {
  const [people, entries, openingPositions] = await Promise.all([
    loadPeople(userId),
    loadEntriesByName(userId),
    loadOpeningLoanPositions(userId),
  ]);
  const grouped = mapEntriesToPeople(people, entries);
  const groupedOpening = mapOpeningPositionsToPeople(people, openingPositions);

  const summaries = people.map((person) => {
    const personEntries = grouped.get(person.id) ?? [];
    const personOpening = groupedOpening.get(person.id) ?? [];
    let totalGiven = 0;
    let totalReceivedBack = 0;
    let totalTaken = 0;
    let totalRepaid = 0;

    for (const entry of personEntries) {
      const amount = entry.amount.toNumber();

      if (entry.entryType === EntryType.LOAN_GIVEN) {
        totalGiven += amount;
      } else if (entry.entryType === EntryType.LOAN_RECEIVED_BACK) {
        totalReceivedBack += amount;
      } else if (entry.entryType === EntryType.LOAN_TAKEN) {
        totalTaken += amount;
      } else if (entry.entryType === EntryType.LOAN_REPAID) {
        totalRepaid += amount;
      }
    }

    for (const item of personOpening) {
      if (item.direction === "RECEIVABLE") {
        totalGiven += item.amount;
      } else {
        totalTaken += item.amount;
      }
    }

    const latestEntryDate = personEntries[0]?.entryDate ?? null;
    const latestOpeningDate = personOpening[0]?.createdAt ?? null;
    const latestDate =
      latestEntryDate && latestOpeningDate
        ? latestEntryDate > latestOpeningDate
          ? latestEntryDate
          : latestOpeningDate
        : latestEntryDate ?? latestOpeningDate;

    return {
      personId: person.id,
      personName: person.displayName,
      aliases: person.aliases.filter(
        (alias) => normalizePersonLookup(alias) !== normalizePersonLookup(person.displayName),
      ),
      totalGiven,
      totalReceivedBack,
      totalTaken,
      totalRepaid,
      netReceivable: Math.max(totalGiven - totalReceivedBack, 0),
      netPayable: Math.max(totalTaken - totalRepaid, 0),
      transactionCount: personEntries.length + personOpening.length,
      lastTransactionDate: latestDate ? latestDate.toISOString() : new Date(0).toISOString(),
    } satisfies PersonSummary;
  });

  return summaries
    .filter((person) => person.transactionCount > 0)
    .sort((a, b) => b.netReceivable + b.netPayable - (a.netReceivable + a.netPayable));
}

export async function getPersonMergeSuggestions(userId: string) {
  const people = await loadPeople(userId);
  const suggestions = new Map<string, PersonMergeSuggestion>();

  for (let index = 0; index < people.length; index += 1) {
    const current = people[index];

    for (let compareIndex = index + 1; compareIndex < people.length; compareIndex += 1) {
      const candidate = people[compareIndex];

      if (
        !isShortLongNameVariant(current.displayName, candidate.displayName) &&
        !candidate.aliases.some((alias) => isShortLongNameVariant(alias, current.displayName)) &&
        !current.aliases.some((alias) => isShortLongNameVariant(alias, candidate.displayName))
      ) {
        continue;
      }

      const currentTokenCount = normalizePersonLookup(current.displayName).split(" ").filter(Boolean).length;
      const candidateTokenCount = normalizePersonLookup(candidate.displayName).split(" ").filter(Boolean).length;
      const currentIsTarget =
        currentTokenCount > candidateTokenCount ||
        (currentTokenCount === candidateTokenCount &&
          current.displayName.length >= candidate.displayName.length);

      const target = currentIsTarget ? current : candidate;
      const source = currentIsTarget ? candidate : current;
      const key = `${source.id}:${target.id}`;

      if (suggestions.has(key)) {
        continue;
      }

      suggestions.set(key, {
        sourcePersonId: source.id,
        sourcePersonName: source.displayName,
        targetPersonId: target.id,
        targetPersonName: target.displayName,
        reason: `${source.displayName} short name lag raha hai, aur ${target.displayName} uska full name ho sakta hai.`,
      });
    }
  }

  return Array.from(suggestions.values()).slice(0, 8);
}

export async function getPersonDetail(userId: string, personId: string) {
  const [people, entries, openingPositions] = await Promise.all([
    loadPeople(userId),
    loadEntriesByName(userId),
    loadOpeningLoanPositions(userId),
  ]);
  const person = people.find((item) => item.id === personId);

  if (!person) {
    throw new Error("The person could not be found.");
  }

  const grouped = mapEntriesToPeople(people, entries);
  const groupedOpening = mapOpeningPositionsToPeople(people, openingPositions);
  const personEntries = grouped.get(person.id) ?? [];
  const personOpening = groupedOpening.get(person.id) ?? [];

  let totalGiven = 0;
  let totalReceivedBack = 0;
  let totalTaken = 0;
  let totalRepaid = 0;
  let otherAmount = 0;

  const transactions: PersonTransaction[] = personEntries.map((entry) => {
    const amount = entry.amount.toNumber();

    if (entry.entryType === EntryType.LOAN_GIVEN) {
      totalGiven += amount;
    } else if (entry.entryType === EntryType.LOAN_RECEIVED_BACK) {
      totalReceivedBack += amount;
    } else if (entry.entryType === EntryType.LOAN_TAKEN) {
      totalTaken += amount;
    } else if (entry.entryType === EntryType.LOAN_REPAID) {
      totalRepaid += amount;
    } else {
      otherAmount += amount;
    }

    return {
      id: entry.id,
      amount,
      entryType: entry.entryType,
      category: entry.category,
      note: entry.note,
      entryDate: entry.entryDate.toISOString(),
      sourceText: entry.sourceText,
      createdAt: entry.createdAt.toISOString(),
    };
  });

  const openingTransactions: PersonTransaction[] = personOpening.map((item) => ({
    id: `opening-${item.id}`,
    amount: item.amount,
    entryType: item.direction === "RECEIVABLE" ? "LOAN_GIVEN" : "LOAN_TAKEN",
    category: "opening position",
    note:
      item.direction === "RECEIVABLE"
        ? `Opening receivable with ${person.displayName}.`
        : `Opening payable to ${person.displayName}.`,
    entryDate: item.createdAt.toISOString(),
    sourceText:
      item.direction === "RECEIVABLE"
        ? `Opening receivable for ${person.displayName}`
        : `Opening payable for ${person.displayName}`,
    createdAt: item.createdAt.toISOString(),
  }));

  for (const item of personOpening) {
    if (item.direction === "RECEIVABLE") {
      totalGiven += item.amount;
    } else {
      totalTaken += item.amount;
    }
  }

  return {
    personId: person.id,
    personName: person.displayName,
    aliases: person.aliases.filter(
      (alias) => normalizePersonLookup(alias) !== normalizePersonLookup(person.displayName),
    ),
    summary: {
      totalGiven,
      totalReceivedBack,
      totalTaken,
      totalRepaid,
      otherAmount,
      netReceivable: Math.max(totalGiven - totalReceivedBack, 0),
      netPayable: Math.max(totalTaken - totalRepaid, 0),
      transactionCount: personEntries.length + personOpening.length,
    },
    transactions: [...openingTransactions, ...transactions].sort((left, right) =>
      right.entryDate.localeCompare(left.entryDate),
    ),
  } satisfies PersonDetail;
}

async function ensureUniquePersonName(userId: string, normalizedName: string, excludedPersonId: string) {
  const existing = await prismaClient.person.findFirst({
    where: {
      userId,
      id: {
        not: excludedPersonId,
      },
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
  });

  return existing;
}

export async function renamePerson(params: {
  userId: string;
  personId: string;
  displayName: string;
}) {
  const displayName = params.displayName.trim();
  if (!displayName) {
    throw new Error("A person name is required.");
  }

  const normalizedName = normalizePersonLookup(displayName);
  const person = await prismaClient.person.findFirst({
    where: {
      id: params.personId,
      userId: params.userId,
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!person) {
    throw new Error("The person could not be found.");
  }

  const conflicting = await ensureUniquePersonName(params.userId, normalizedName, person.id);
  if (conflicting) {
    throw new Error(`"${displayName}" is already linked to ${conflicting.displayName}.`);
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.person.update({
      where: {
        id: person.id,
      },
      data: {
        displayName,
        normalizedDisplayName: normalizedName,
      },
    });

    await tx.personAlias.upsert({
      where: {
        personId_normalizedAlias: {
          personId: person.id,
          normalizedAlias: normalizePersonLookup(person.displayName),
        },
      },
      update: {
        alias: person.displayName,
      },
      create: {
        personId: person.id,
        alias: person.displayName,
        normalizedAlias: normalizePersonLookup(person.displayName),
      },
    });

    await tx.ledgerEntry.updateMany({
      where: {
        userId: params.userId,
        personName: person.displayName,
      },
      data: {
        personName: displayName,
      },
    });

    await tx.reminder.updateMany({
      where: {
        userId: params.userId,
        linkedPerson: person.displayName,
      },
      data: {
        linkedPerson: displayName,
      },
    });
  });

  return {
    ok: true as const,
    message: "Person name updated successfully.",
  };
}

export async function addPersonAlias(params: {
  userId: string;
  personId: string;
  alias: string;
}) {
  const alias = params.alias.trim();
  if (!alias) {
    throw new Error("An alias is required.");
  }

  const normalizedAlias = normalizePersonLookup(alias);
  const person = await prismaClient.person.findFirst({
    where: {
      id: params.personId,
      userId: params.userId,
    },
    select: {
      id: true,
      displayName: true,
      aliases: {
        select: {
          alias: true,
          normalizedAlias: true,
        },
      },
    },
  });

  if (!person) {
    throw new Error("The person could not be found.");
  }

  const matchingOtherPerson = await prismaClient.person.findFirst({
    where: {
      userId: params.userId,
      id: {
        not: person.id,
      },
      OR: [
        {
          normalizedDisplayName: normalizedAlias,
        },
        {
          aliases: {
            some: {
              normalizedAlias,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      displayName: true,
      aliases: {
        select: {
          alias: true,
          normalizedAlias: true,
        },
      },
    },
  });

  await prismaClient.$transaction(async (tx) => {
    if (matchingOtherPerson) {
      const namesToMove = Array.from(
        new Set([
          matchingOtherPerson.displayName,
          ...matchingOtherPerson.aliases.map((item) => item.alias),
        ]),
      );

      await tx.ledgerEntry.updateMany({
        where: {
          userId: params.userId,
          personName: {
            in: namesToMove,
          },
        },
        data: {
          personName: person.displayName,
        },
      });

      await tx.reminder.updateMany({
        where: {
          userId: params.userId,
          linkedPerson: {
            in: namesToMove,
          },
        },
        data: {
          linkedPerson: person.displayName,
        },
      });

      for (const carriedAlias of namesToMove) {
        const normalizedCarriedAlias = normalizePersonLookup(carriedAlias);
        if (!normalizedCarriedAlias || normalizedCarriedAlias === normalizePersonLookup(person.displayName)) {
          continue;
        }

        await tx.personAlias.upsert({
          where: {
            personId_normalizedAlias: {
              personId: person.id,
              normalizedAlias: normalizedCarriedAlias,
            },
          },
          update: {
            alias: carriedAlias,
          },
          create: {
            personId: person.id,
            alias: carriedAlias,
            normalizedAlias: normalizedCarriedAlias,
          },
        });
      }

      await tx.personAlias.deleteMany({
        where: {
          personId: matchingOtherPerson.id,
        },
      });

      await tx.person.delete({
        where: {
          id: matchingOtherPerson.id,
        },
      });
    }

    if (normalizedAlias !== normalizePersonLookup(person.displayName)) {
      await tx.personAlias.upsert({
        where: {
          personId_normalizedAlias: {
            personId: person.id,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          personId: person.id,
          alias,
          normalizedAlias,
        },
      });
    }
  });

  return {
    ok: true as const,
    message: matchingOtherPerson
      ? `Alias added and ${matchingOtherPerson.displayName} was merged into ${person.displayName}.`
      : "Alias added successfully.",
  };
}
