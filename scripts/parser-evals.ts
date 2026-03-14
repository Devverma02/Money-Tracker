import { parseMoneyInputHeuristically } from "../src/lib/ai/heuristic-parse";

type EvalCase = {
  name: string;
  inputText: string;
  assert: (result: ReturnType<typeof parseMoneyInputHeuristically>) => string[];
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
    assert: (result) => [
      expectEqual(result.actions.length, 3, "actions.length"),
      expectEqual(result.actions[0]?.amount, 480, "first amount"),
      expectEqual(result.actions[1]?.category, "travel", "second category"),
      expectEqual(result.actions[2]?.entryType, "loan_given", "third entry type"),
    ].filter(Boolean) as string[],
  },
  {
    name: "person normalization",
    inputText: "Raju bhai ko 15k loan diya kal",
    assert: (result) => [
      expectEqual(result.actions[0]?.personName, "Raju", "person name"),
      expectEqual(result.actions[0]?.amount, 15000, "amount"),
      expectEqual(result.actions[0]?.entryType, "loan_given", "entry type"),
    ].filter(Boolean) as string[],
  },
  {
    name: "month name date",
    inputText: "5 March 2026 salary income 15000",
    assert: (result) => [
      expectEqual(result.actions[0]?.resolvedDate, "2026-03-05", "resolvedDate"),
      expectEqual(result.actions[0]?.entryType, "income", "entry type"),
    ].filter(Boolean) as string[],
  },
  {
    name: "slash date",
    inputText: "12/02/2026 doctor expense 800",
    assert: (result) => [
      expectEqual(result.actions[0]?.resolvedDate, "2026-02-12", "resolvedDate"),
      expectEqual(result.actions[0]?.category, "health", "category"),
    ].filter(Boolean) as string[],
  },
  {
    name: "lakh amount",
    inputText: "Amit se 2 lakh loan liya",
    assert: (result) => [
      expectEqual(result.actions[0]?.amount, 200000, "amount"),
      expectEqual(result.actions[0]?.entryType, "loan_taken", "entry type"),
      expectEqual(result.actions[0]?.personName, "Amit", "person name"),
    ].filter(Boolean) as string[],
  },
  {
    name: "weekday date support",
    inputText: "Last Monday petrol expense 500",
    assert: (result) => [
      expectTruthy(result.actions[0]?.resolvedDate, "resolvedDate"),
      expectEqual(result.actions[0]?.category, "travel", "category"),
    ].filter(Boolean) as string[],
  },
];

let failureCount = 0;

for (const testCase of cases) {
  const result = parseMoneyInputHeuristically({
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
