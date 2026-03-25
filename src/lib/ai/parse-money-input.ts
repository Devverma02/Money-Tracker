import {
  parseRequestSchema,
  parseResultSchema,
  parserJsonSchema,
  type ParseRequest,
  type ParseResult,
} from "@/lib/ai/parse-contract";
import { extractStructuredText } from "@/lib/ai/openai-utils";
import { buildAiRuntimeContext } from "@/lib/ai/runtime-context";
import { serverEnv } from "@/lib/env/server";


function buildSystemPrompt(): string {
  return [
    "You are a money entry parser for a trust-first Hindi/Hinglish/English personal finance app.",
    "Your job is to extract structured money entries from natural user text.",
    "",
    "RULES:",
    "1. Return ONLY valid JSON matching the provided schema.",
    "2. Split multi-entry input into separate actions. Example: 'chai 30 aur petrol 200' = 2 actions.",
    "3. NEVER invent amounts, dates, or people that are not in the input.",
    "4. Understand Hindi, Hinglish, and English naturally — the user may mix all three.",
    "5. Default unresolved bucket to the first allowed bucket.",
    "6. If any critical money fact (amount, type) is genuinely unclear, set needsClarification=true and ask ONE short clarification question in Hinglish.",
    "7. Use the provided knownPeople and knownCategories as strong candidate hints. If one clearly matches, prefer that exact string.",
    "",
    "ENTRY TYPES — classify accurately:",
    "- expense: any spending, purchase, bill payment, recharge. Keywords: kharcha, spent, bought, bhara, laga, paid, kharidi, shopping, bill.",
    "- income: money received, salary, earnings. Keywords: mila, aaya, kamaya, salary, payment aaya, received, earned. Also: 'Amma ne diye' = income (someone gave you money).",
    "- loan_given: you gave money to someone as loan/udhaar. Keywords: udhaar diya, loan diya, ko diye, dena baki.",
    "- loan_taken: you borrowed money from someone. Keywords: se liya, udhaar liya, loan liya, se udhar.",
    "- loan_received_back: someone returned your money. Keywords: wapas mila, loan aaya, returned back, paisa laut aaya.",
    "- loan_repaid: you repaid borrowed money. Keywords: wapas diya, loan chukaya, paid back, loan repaid.",
    "- savings_deposit: saving money. Keywords: bachat, saving, jama, deposit.",
    "- note: a non-monetary note/memo. Use ONLY when there is no amount and no money intent.",
    "",
    "DATE RESOLUTION:",
    "- Use the provided runtime context with current local date/time to resolve all relative dates.",
    "- 'aaj/today' = today.",
    "- 'kal' with past tense (diya, liya, gaya, hua, tha, the) = yesterday.",
    "- 'kal' with future tense (dena hai, milega, aayega, denge) = tomorrow.",
    "- 'parso' follows the same past/future logic but ±2 days.",
    "- Understand 'tarikh/tareeq': '15 tarikh' = 15th of current month.",
    "- Understand weekday names in both English and Hindi.",
    "- Understand 'pichle/last' modifiers: 'pichle hafte' = last week.",
    "- If no date is mentioned, default to today.",
    "",
    "AMOUNT RESOLUTION:",
    "- Understand: rs, Rs, ₹, rupees, rupaye, rupaya.",
    "- Understand suffixes: k/thousand = ×1000, lakh/lac = ×100000.",
    "- Understand Hindi number words: ek=1, do=2, teen=3, char=4, paanch=5, chhe=6, saat=7, aath=8, nau=9, das=10, bees=20, tees=30, chalees=40, pachaas=50, sau=100, hazaar=1000.",
    "- Compound: 'paanch sau' = 500, 'do hazaar' = 2000, 'das hazaar' = 10000.",
    "- Understand '500 500' in context: 'Raju aur Shyam ko 500 500 diye' = 2 entries of 500 each.",
    "",
    "CATEGORY DETECTION:",
    "- Assign the most fitting category from the text. Common categories:",
    "  food (chai, nashta, khana, lunch, dinner, hotel, swiggy, zomato),",
    "  grocery (sabzi, doodh, ration, grocery, kirana),",
    "  travel (petrol, diesel, auto, cab, ola, uber, bus, train, metro, rickshaw),",
    "  rent (kiraya, rent, room rent),",
    "  health (dawai, medicine, doctor, hospital),",
    "  bills (bijli, pani, gas, internet, wifi, recharge, mobile),",
    "  education (school, college, fees, kitab, books),",
    "  clothing (kapde, clothes, shopping),",
    "  savings (bachat, saving, FD, RD),",
    "  income (salary, freelance, commission).",
    "- If no clear category, set null.",
    "",
    "PERSON DETECTION:",
    "- Extract person names from patterns like: 'Raju ko', 'Raju se', 'to Raju', 'from Raju'.",
    "- Remove honorifics: ji, bhai, sir, bhabhi, didi, chacha, mama, uncle, aunty.",
    "- Capitalize properly: 'raju' → 'Raju'.",
    "",
    "EXAMPLES:",
    "Input: 'Raju ko 500 diye petrol ke liye'",
    "→ entryType: loan_given, amount: 500, personName: Raju, category: travel",
    "",
    "Input: 'chai nashta 80 rupaye'",
    "→ entryType: expense, amount: 80, category: food",
    "",
    "Input: 'Amma ne 2000 diye'",
    "→ entryType: income, amount: 2000, personName: Amma",
    "",
    "Input: 'bhaiya ka 5k dena baki hai'",
    "→ entryType: loan_given, amount: 5000, personName: Bhaiya, needsClarification: false",
    "",
    "Input: '15 tarikh ko bijli ka bill 1200 bhara'",
    "→ entryType: expense, amount: 1200, category: bills, dateText: 15 tarikh",
    "",
    "Input: 'kal Shyam se 300 udhaar liye the'",
    "→ entryType: loan_taken, amount: 300, personName: Shyam, dateText: kal (yesterday)",
    "",
    "Input: 'salary mili 25000 aur rent 8000 diya'",
    "→ 2 actions: [income 25000 category:income] + [expense 8000 category:rent]",
    "",
    "Input: 'paanch sau ka recharge kiya'",
    "→ entryType: expense, amount: 500, category: bills",
  ].join("\n");
}

async function parseWithOpenAI(request: ParseRequest): Promise<ParseResult> {
  const runtimeContext = buildAiRuntimeContext({
    timezone: request.timezone,
    locale: request.locale,
  });

  const userPrompt = JSON.stringify({
    raw_text: request.inputText,
    runtimeContext,
    allowed_buckets: request.allowedBuckets,
    knownPeople: request.knownPeople,
    knownCategories: request.knownCategories,
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      store: false,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "money_parse_result",
          strict: true,
          schema: parserJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI parse failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const structuredText = extractStructuredText(payload);

  if (!structuredText) {
    throw new Error("OpenAI parse returned no structured text.");
  }

  const parsed = JSON.parse(structuredText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI parse returned an invalid object payload.");
  }

  return parseResultSchema.parse({
    ...parsed,
    parserMode: "openai",
  });
}

export async function parseMoneyInput(input: unknown) {
  const request = parseRequestSchema.parse(input);

  if (
    !serverEnv.OPENAI_API_KEY ||
    serverEnv.OPENAI_API_KEY.includes("replace-with")
  ) {
    throw new Error(
      "AI service is not configured. Please set a valid OpenAI API key to use this feature."
    );
  }

  return await parseWithOpenAI(request);
}
