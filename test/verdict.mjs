// The verdict label used to come from the model, which had three names for four
// outcomes. It came back APPROVE on one run and REJECT on the next with the same
// reasoning, and that single gap moved three suites by twenty points between runs.
// The label is arithmetic now, so it gets asserted as arithmetic.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const money = (n) => Math.round(Number(n) * 100) / 100;

// The rule, exactly as the source applies it.
function label(total, rawAllowed, rawDisallowed, cannotDecide) {
  const allowed = Math.max(0, Math.min(money(rawAllowed ?? 0), money(total)));
  const disallowed = Math.max(0, money(rawDisallowed ?? money(total) - allowed));
  return {
    allowed, disallowed,
    verdict: cannotDecide ? "ESCALATE"
      : allowed <= 0.01 ? "REJECT"
      : disallowed <= 0.01 ? "APPROVE"
      : "PARTIAL",
  };
}

console.log("\nThe four outcomes follow from the money");
t("nothing disallowed is a full allowance", label(9400, 9400, 0).verdict === "APPROVE");
t("nothing allowed is a refusal", label(9400, 0, 9400).verdict === "REJECT");
t("some of each is a partial allowance", label(9400, 9000, 400).verdict === "PARTIAL");
t("cannot decide wins over any amount", label(9400, 9000, 400, true).verdict === "ESCALATE");

console.log("\nThe cases that flipped between runs now cannot");
for (const [name, total, a, d] of [
  ["hotel 400 over a 9,000 cap", 9400, 9000, 400],
  ["team lunch over a per-head cap", 7600, 6000, 1600],
  ["one rupee over the cap", 9001, 9000, 1],
  ["minibar deducted from a stay", 90844, 87854, 2990],
]) t(name, label(total, a, d).verdict === "PARTIAL", `allowed ${a}, disallowed ${d}`);

console.log("\nIncoherent numbers are made coherent rather than trusted");
t("allowed above the charge is clamped", label(9400, 99999, 0).allowed === 9400);
t("negative allowed becomes zero", label(9400, -50, 9400).verdict === "REJECT");
t("missing disallowed is inferred", label(9400, 9000, undefined).disallowed === 400);
t("missing allowed is a refusal", label(9400, undefined, undefined).verdict === "REJECT");
t("a rounding crumb is not a partial allowance",
  label(9400, 9399.995, 0.005).verdict === "APPROVE", "under a paisa either side");

console.log("\nThe prompt no longer asks for a label it has no name for");
const src = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("no three-way verdict in the schema", !/"verdict": "APPROVE"\|"REJECT"\|"ESCALATE"/.test(src));
t("asks for the money instead", /"amount_allowed": number/.test(src) && /"cannot_decide": boolean/.test(src));
t("tells it not to label the outcome", /Do not label the outcome/.test(src));
t("says a partial allowance is ordinary", /Allowing part of a charge and disallowing the rest is an ordinary answer/.test(src));
t("derives the verdict in code", /json\.verdict = json\.cannot_decide \? "ESCALATE"/.test(src));

console.log("\nEverything downstream understands a partial allowance");
t("the evidence guardrail covers it", /json\.verdict === "APPROVE" \|\| json\.verdict === "PARTIAL"/.test(src));
t("the authority limit covers it",
  /adjudication\.verdict === "APPROVE" \|\| adjudication\.verdict === "PARTIAL"/.test(src));
const runner = fs.readFileSync("test/eval/run.mjs", "utf8");
t("the harness stops guessing", !/raw === "APPROVE" && disallowed > 0/.test(runner));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
