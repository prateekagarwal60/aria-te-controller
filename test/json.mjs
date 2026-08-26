// The JSON extractor is the single point every agent decision passes through.
// It gets asserted hard, because a parse failure here looks like a model failure.
import { extractJson } from "../.evalbuild/anthropic.mjs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nJSON extraction");
t("plain object", extractJson('{"verdict":"APPROVE"}')?.verdict === "APPROVE");
t("leading whitespace and newlines", extractJson('\n\n  {"verdict":"REJECT"}  \n')?.verdict === "REJECT");
t("fenced with json tag", extractJson('```json\n{"verdict":"APPROVE"}\n```')?.verdict === "APPROVE");
t("fenced without tag", extractJson('```\n{"verdict":"APPROVE"}\n```')?.verdict === "APPROVE");
t("preamble before the object",
  extractJson('Here is my assessment:\n{"verdict":"ESCALATE","confidence":0.4}')?.verdict === "ESCALATE");
t("trailing sentence after the object",
  extractJson('{"verdict":"APPROVE"}\n\nLet me know if you need more detail.')?.verdict === "APPROVE");
t("both preamble and trailing",
  extractJson('Sure.\n{"verdict":"REJECT"}\nHope that helps.')?.verdict === "REJECT");

console.log("\nBraces inside string values");
const quoted = extractJson('{"reasoning":"Clause 4.1 states {cap} applies","verdict":"REJECT"}');
t("brace inside a quoted value does not truncate", quoted?.verdict === "REJECT", JSON.stringify(quoted));
const escaped = extractJson('{"quote":"He said \\"no\\" and left","verdict":"APPROVE"}');
t("escaped quotes survive", escaped?.verdict === "APPROVE", JSON.stringify(escaped));
const nested = extractJson('{"a":{"b":{"c":1}},"verdict":"APPROVE"}');
t("deep nesting", nested?.verdict === "APPROVE" && nested.a.b.c === 1);
const arr = extractJson('{"clauses":[{"quote":"x"},{"quote":"y"}],"verdict":"REJECT"}');
t("array of objects", arr?.clauses?.length === 2);

console.log("\nRealistic Decide payload");
const real = extractJson(`I'll assess this against the policy.

\`\`\`json
{
  "verdict": "REJECT",
  "confidence": 0.92,
  "amount_allowed": 0,
  "amount_disallowed": 5827,
  "clauses": [
    {"quote": "Alcohol on a solo or team meal is not reimbursable at any amount.",
     "applies_because": "The bill includes six craft beers on a team meal."}
  ],
  "reasoning": "The receipt shows {6} beers. Clause 7.2 disallows this.",
  "question_for_controller": null
}
\`\`\`

Let me know if you'd like the food portion assessed separately.`);
t("full payload parses", real?.verdict === "REJECT");
t("nested clause survived", real?.clauses?.[0]?.quote?.startsWith("Alcohol"));
t("brace in reasoning survived", real?.reasoning?.includes("{6}"));

console.log("\nA complete object that JSON.parse still refuses");
/* One call in 121 came back with well-formed JSON that would not parse, and it
   was not truncation. Raw control characters inside a string value are invalid
   JSON and models emit them. */
const rawNewline = extractJson('{"reasoning":"line one\nline two","cannot_decide":true}');
t("raw newline inside a value is repaired", rawNewline?.cannot_decide === true);
t("and the newline survives as a newline", rawNewline?.reasoning === "line one\nline two");
t("raw tab is repaired", extractJson('{"reasoning":"a\tb","amount_allowed":0}')?.amount_allowed === 0);
t("the shape that actually failed", extractJson(`{
  "amount_allowed": 0,
  "cannot_decide": true,
  "confidence": 0.35,
  "reasoning": "The memo says solo.
The receipt says six covers."
}`)?.confidence === 0.35);
t("an already escaped newline is not double escaped",
  extractJson('{"reasoning":"line one\\nline two"}')?.reasoning === "line one\nline two");
t("a quote inside a value still survives",
  extractJson('{"reasoning":"he said \\"no\\""}')?.reasoning === 'he said "no"');
t("repairing does not rescue a truncated object",
  extractJson('{"amount_allowed": 0, "reasoning": "cut off') === null,
  "truncation is a different failure and must stay distinguishable");

console.log("\nFailure cases return null rather than guessing");
t("empty string", extractJson("") === null);
t("no object at all", extractJson("I cannot answer that.") === null);
t("unterminated object", extractJson('{"verdict":"APPROVE"') === null);
t("malformed json", extractJson('{verdict: APPROVE}') === null);
t("null input", extractJson(null) === null);

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
