process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";

type EvalCase = {
  name: string;
  inputText: string;
  mockedResult: unknown;
  assert: (result: {
    actions: Array<{
      amount: number | null;
      category: string | null;
      entryType: string | null;
      personName: string | null;
      resolvedDate: string | null;
    }>;
  }) => string[];
};

function expectEqual<T>(actual: T, expected: T, label: string) {
  return actual === expected ? null : `${label}: expected ${expected}, got ${actual}`;
}

function expectTruthy(value: unknown, label: string) {
  return value ? null : `${label}: expected a truthy value`;
}

const cases: EvalCase[] = [
  {
    name: "multi-entry split",
    inputText: "Aaj 480 groceries aur 200 petrol, kal Raju ko 1000 loan diya",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 480,
          entryType: "expense",
          category: "grocery",
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "aaj",
          resolvedDate: "2026-03-23",
          sourceText: "Aaj 480 groceries",
        },
        {
          intentType: "create_entry",
          amount: 200,
          entryType: "expense",
          category: "travel",
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "aaj",
          resolvedDate: "2026-03-23",
          sourceText: "200 petrol",
        },
        {
          intentType: "create_entry",
          amount: 1000,
          entryType: "loan_given",
          category: null,
          bucket: "personal",
          personName: "Raju",
          note: null,
          dateText: "kal",
          resolvedDate: "2026-03-22",
          sourceText: "kal Raju ko 1000 loan diya",
        },
      ],
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "3 entries are ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions.length, 3, "actions.length"),
        expectEqual(result.actions[0]?.amount, 480, "first amount"),
        expectEqual(result.actions[1]?.category, "travel", "second category"),
        expectEqual(result.actions[2]?.entryType, "loan_given", "third entry type"),
      ].filter(Boolean) as string[],
  },
  {
    name: "person normalization",
    inputText: "Raju bhai ko 15k loan diya kal",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 15000,
          entryType: "loan_given",
          category: null,
          bucket: "personal",
          personName: "Raju",
          note: null,
          dateText: "kal",
          resolvedDate: "2026-03-22",
          sourceText: "Raju bhai ko 15k loan diya kal",
        },
      ],
      confidence: 0.96,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.personName, "Raju", "person name"),
        expectEqual(result.actions[0]?.amount, 15000, "amount"),
        expectEqual(result.actions[0]?.entryType, "loan_given", "entry type"),
      ].filter(Boolean) as string[],
  },
  {
    name: "month name date",
    inputText: "5 March 2026 salary income 15000",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 15000,
          entryType: "income",
          category: "income",
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "5 March 2026",
          resolvedDate: "2026-03-05",
          sourceText: "5 March 2026 salary income 15000",
        },
      ],
      confidence: 0.97,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.resolvedDate, "2026-03-05", "resolvedDate"),
        expectEqual(result.actions[0]?.entryType, "income", "entry type"),
      ].filter(Boolean) as string[],
  },
  {
    name: "slash date",
    inputText: "12/02/2026 doctor expense 800",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 800,
          entryType: "expense",
          category: "health",
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "12/02/2026",
          resolvedDate: "2026-02-12",
          sourceText: "12/02/2026 doctor expense 800",
        },
      ],
      confidence: 0.94,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.resolvedDate, "2026-02-12", "resolvedDate"),
        expectEqual(result.actions[0]?.category, "health", "category"),
      ].filter(Boolean) as string[],
  },
  {
    name: "lakh amount",
    inputText: "Amit se 2 lakh loan liya",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 200000,
          entryType: "loan_taken",
          category: null,
          bucket: "personal",
          personName: "Amit",
          note: null,
          dateText: null,
          resolvedDate: "2026-03-23",
          sourceText: "Amit se 2 lakh loan liya",
        },
      ],
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.amount, 200000, "amount"),
        expectEqual(result.actions[0]?.entryType, "loan_taken", "entry type"),
        expectEqual(result.actions[0]?.personName, "Amit", "person name"),
      ].filter(Boolean) as string[],
  },
  {
    name: "weekday date support",
    inputText: "Last Monday petrol expense 500",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 500,
          entryType: "expense",
          category: "travel",
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "Last Monday",
          resolvedDate: "2026-03-16",
          sourceText: "Last Monday petrol expense 500",
        },
      ],
      confidence: 0.92,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectTruthy(result.actions[0]?.resolvedDate, "resolvedDate"),
        expectEqual(result.actions[0]?.category, "travel", "category"),
      ].filter(Boolean) as string[],
  },
  {
    name: "future kal support",
    inputText: "Raju se kal 2000 rs aayenge",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 2000,
          entryType: "income",
          category: null,
          bucket: "personal",
          personName: "Raju",
          note: null,
          dateText: "kal",
          resolvedDate: "2026-03-24",
          sourceText: "Raju se kal 2000 rs aayenge",
        },
      ],
      confidence: 0.88,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.resolvedDate, "2026-03-24", "resolvedDate"),
        expectEqual(result.actions[0]?.personName, "Raju", "person name"),
      ].filter(Boolean) as string[],
  },
  {
    name: "future parso support",
    inputText: "Parso 5000 milenge",
    mockedResult: {
      actions: [
        {
          intentType: "create_entry",
          amount: 5000,
          entryType: "income",
          category: null,
          bucket: "personal",
          personName: null,
          note: null,
          dateText: "Parso",
          resolvedDate: "2026-03-25",
          sourceText: "Parso 5000 milenge",
        },
      ],
      confidence: 0.87,
      needsClarification: false,
      clarificationQuestion: null,
      parserMode: "openai",
      summaryText: "One entry is ready to review and save.",
    },
    assert: (result) =>
      [
        expectEqual(result.actions[0]?.resolvedDate, "2026-03-25", "resolvedDate"),
        expectEqual(result.actions[0]?.amount, 5000, "amount"),
      ].filter(Boolean) as string[],
  },
];

const mockedResults = new Map(
  cases.map((testCase) => [testCase.inputText, testCase.mockedResult]),
);

globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  const userPrompt =
    typeof body?.input?.[1]?.content === "string"
      ? JSON.parse(body.input[1].content)
      : null;
  const rawText = userPrompt?.raw_text;
  const mockedResult = rawText ? mockedResults.get(rawText) : null;

  if (!mockedResult) {
    throw new Error(`No mocked parser result found for input: ${String(rawText)}`);
  }

  return new Response(
    JSON.stringify({
      output_text: JSON.stringify(mockedResult),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}) as typeof fetch;

async function main() {
  const { parseMoneyInput } = await import("../src/lib/ai/parse-money-input");

  let failureCount = 0;

  for (const testCase of cases) {
    const result = await parseMoneyInput({
      inputText: testCase.inputText,
      locale: "hi-IN",
      timezone: "Asia/Kolkata",
      allowedBuckets: ["personal"],
    });
    const failures = testCase.assert(result);

    if (failures.length === 0) {
      console.log(`PASS ${testCase.name}`);
      continue;
    }

    failureCount += 1;
    console.error(`FAIL ${testCase.name}`);

    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
  }

  if (failureCount > 0) {
    console.error(`\n${failureCount} parser eval case(s) failed.`);
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} parser eval cases passed.`);
}

void main();
