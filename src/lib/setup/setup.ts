import { OpeningLoanDirection, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizePersonLookup,
} from "@/lib/persons/person-resolution";
import type {
  SetupResponse,
  UpdateSetupRequest,
} from "@/lib/setup/setup-contract";

function toNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function normalizePersonName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toDisplayPersonName(value: string) {
  if (/[^\u0000-\u007f]/.test(value)) {
    return normalizePersonName(value);
  }

  return normalizePersonName(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function ensurePersonRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  rawPersonName: string,
) {
  const normalized = normalizePersonLookup(rawPersonName);

  if (!normalized) {
    return;
  }

  const existing = await tx.person.findFirst({
    where: {
      userId,
      OR: [
        {
          normalizedDisplayName: normalized,
        },
        {
          aliases: {
            some: {
              normalizedAlias: normalized,
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

  if (existing) {
    if (normalizePersonLookup(existing.displayName) !== normalized) {
      await tx.personAlias.upsert({
        where: {
          personId_normalizedAlias: {
            personId: existing.id,
            normalizedAlias: normalized,
          },
        },
        update: {
          alias: rawPersonName,
        },
        create: {
          personId: existing.id,
          alias: rawPersonName,
          normalizedAlias: normalized,
        },
      });
    }

    return;
  }

  const displayName = toDisplayPersonName(rawPersonName);

  await tx.person.create({
    data: {
      userId,
      displayName,
      normalizedDisplayName: normalized,
      aliases: {
        create: [
          {
            alias: displayName,
            normalizedAlias: normalized,
          },
        ],
      },
    },
  });
}

export async function getSetupState(userId: string): Promise<SetupResponse> {
  const [profile, ledgerEntryCount] = await Promise.all([
    prisma.appProfile.findUnique({
      where: {
        id: userId,
      },
      select: {
        hasCompletedSetup: true,
        openingBalance: true,
        balanceGuardEnabled: true,
        setupCompletedAt: true,
        openingLoanPositions: {
          select: {
            id: true,
            personName: true,
            direction: true,
            amount: true,
          },
          orderBy: [
            {
              personName: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
        },
      },
    }),
    prisma.ledgerEntry.count({
      where: {
        userId,
      },
    }),
  ]);

  if (!profile) {
    throw new Error("The setup profile could not be found.");
  }

  return {
    hasCompletedSetup:
      profile.hasCompletedSetup ||
      ledgerEntryCount > 0 ||
      toNumber(profile.openingBalance) > 0 ||
      profile.openingLoanPositions.length > 0,
    openingBalance: toNumber(profile.openingBalance),
    balanceGuardEnabled: profile.balanceGuardEnabled ?? true,
    setupCompletedAt: profile.setupCompletedAt?.toISOString() ?? null,
    openingLoans: profile.openingLoanPositions.map((item) => ({
      id: item.id,
      personName: item.personName,
      direction: item.direction,
      amount: toNumber(item.amount),
    })),
  };
}

export async function getOpeningLoanPositions(userId: string) {
  return prisma.openingLoanPosition.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      personName: true,
      normalizedPersonName: true,
      direction: true,
      amount: true,
      createdAt: true,
    },
    orderBy: [
      {
        personName: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
}

export async function updateSetupState(
  userId: string,
  payload: UpdateSetupRequest,
): Promise<SetupResponse> {
  const dedupedLoans = Array.from(
    payload.openingLoans.reduce((accumulator, item) => {
      const personName = normalizePersonName(item.personName);
      const key = `${normalizePersonLookup(personName)}:${item.direction}`;

      if (!personName) {
        return accumulator;
      }

      const existing = accumulator.get(key) ?? {
        personName,
        direction: item.direction,
        amount: 0,
      };

      existing.amount += item.amount;
      accumulator.set(key, existing);
      return accumulator;
    }, new Map<string, { personName: string; direction: "RECEIVABLE" | "PAYABLE"; amount: number }>()),
  ).map(([, item]) => item);

  await prisma.$transaction(async (tx) => {
    await tx.appProfile.update({
      where: {
        id: userId,
      },
      data: {
        openingBalance: new Prisma.Decimal(payload.openingBalance),
        balanceGuardEnabled: payload.balanceGuardEnabled,
        hasCompletedSetup: payload.markSetupComplete,
        setupCompletedAt: payload.markSetupComplete ? new Date() : null,
      },
    });

    await tx.openingLoanPosition.deleteMany({
      where: {
        userId,
      },
    });

    for (const item of dedupedLoans) {
      await ensurePersonRecord(tx, userId, item.personName);

      await tx.openingLoanPosition.create({
        data: {
          userId,
          personName: item.personName,
          normalizedPersonName: normalizePersonLookup(item.personName),
          direction: item.direction as OpeningLoanDirection,
          amount: new Prisma.Decimal(item.amount),
        },
      });
    }
  });

  return getSetupState(userId);
}
