// Three evaluation runs completed every model call and then died on a variable.
// Two were undeclared. The third was declared ten lines below its use, which
// no-undef cannot see because the name does exist: the order is what is wrong.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const run = fs.readFileSync("test/eval/run.mjs", "utf8");
const cfg = fs.readFileSync("eslint.config.mjs", "utf8");

console.log("\nThe rule that catches it is switched on");
t("no-use-before-define is an error", /"no-use-before-define": \["error"/.test(cfg));
t("it covers variables", /variables: true/.test(cfg));
t("and classes", /classes: true/.test(cfg));
t("functions are exempt, because hoisting them is normal", /functions: false/.test(cfg));
t("the reason is recorded beside it", /no-undef cannot\s*\n?\s*see because the name does exist/.test(cfg));

console.log("\nEvery gate is declared before the tally that reads it");
const declared = run.indexOf("const budgetGates = [");
const read = run.indexOf("budgetGates.filter");
t("budgetGates is declared first", declared > 0 && declared < read,
  `declared at ${declared}, read at ${read}`);
for (const name of ["p50", "p95", "perCall", "perCharge"]) {
  const d = run.indexOf(`const ${name} `);
  t(`${name} is declared before budgetGates`, d > 0 && d < declared);
}

console.log("\nAnd every gate declared is actually enforced");
const gateNames = [...run.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
const gatesBlock = run.slice(run.indexOf("const GATES = {"), run.indexOf("};", run.indexOf("const GATES = {")));
const declaredGates = [...gatesBlock.matchAll(/(\w+):/g)].map((m) => m[1]);
void gateNames;
for (const g of declaredGates)
  t(`GATES.${g} is referenced somewhere`, new RegExp(`GATES\\.${g}\\b`).test(run),
    "a gate that does not gate reads like assurance");

console.log("\nA failing budget counts against the run, not just against a printed line");
t("failed budgets join the tally", /const failed = \[\.\.\.failedSuites, \.\.\.failedBudgets\]/.test(run));
t("and the exit code follows the tally", /process\.exit\(failed\.length \? 1 : 0\)/.test(run));

console.log("\nThe consistency case measures what it claims to");
const suites = fs.readFileSync("test/eval/suites.mjs", "utf8");
t("the clean charge now carries its trip approval", /Trip approval TA-2291/.test(suites));
t("and the reason it had to is recorded", /clause 2\.1 requires one for any\s*\n?\s*air ticket/.test(suites));
t("the ambiguous case is still ambiguous on purpose", /Genuinely ambiguous/.test(suites));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
