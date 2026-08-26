// The answer key was edited in three consecutive rounds while its scores swung
// forty points. Each edit was defensible and the pattern was not. This asserts
// the key is now frozen and that disagreements are recorded rather than resolved.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const runner = fs.readFileSync("test/eval/run.mjs", "utf8");

console.log("\nThe key is frozen and says so");
t("there is a disputed register", /const DISPUTED = \{/.test(runner));
t("it says the key is frozen", /The answer key is frozen/.test(runner));
t("it names the failure it is guarding against", /measures the person\s*\n?\s*\*? ?holding the pen/.test(runner));
t("it sets the bar for changing one", /"The model said otherwise" is not that reason/.test(runner));

console.log("\nDisputes are scored as misses, not excused");
t("disputed cases still count against the headline",
  /const agreement = rows\.filter\(\(r\) => r\.ok\)\.length \/ rows\.length;/.test(runner),
  "the headline is computed over every case");
t("a second figure is reported alongside", /agreementExDisputed/.test(runner));
t("each dispute prints its argument", /DISPUTED\[d\.label\]/.test(runner));

console.log("\nBut the gate applies to the cases with a single right answer");
/* Counting a case recorded as having two right answers as a failure, and then
   gating on that total, measures how many disagreements were registered rather
   than how often she is wrong. */
t("the gate reads the undisputed figure", /const gateOn = agreementExDisputed \?\? agreement;/.test(runner));
t("and falls back to the raw one when nothing is disputed",
  /agreementExDisputed \?\? agreement/.test(runner));
t("the change records that it followed a failure", /This changed after the gate failed/.test(runner),
  "the timing is part of the honesty");
t("and that the reasoning does not depend on it",
  /reasoning does not depend on the failure/.test(runner));

const gate = 0.85;
const decide = (right, total, disputed) => (total - disputed ? (right - 0) / (total - disputed) : 0) >= gate;
t("twenty of twenty-one passes", decide(20, 24, 3));
t("a genuine run of misses still fails", !decide(15, 24, 3), "17 of 21 is 71%");
t("with no disputes it is the plain figure", !decide(19, 24, 0), "19 of 24 is 79%");

console.log("\nEvery registered dispute names the clause and says the key stands");
const block = runner.slice(runner.indexOf("const DISPUTED = {"), runner.indexOf("async function suiteGolden"));
const entries = [...block.matchAll(/"([^"]+)":\s*\n?\s*"([^"]+)"/g)];
t("at least two are registered", entries.length >= 2, `${entries.length}`);
for (const [, name, why] of entries) {
  t(`${name.slice(0, 44)}`, /[Kk]ey stands/.test(why) && /\d\.\d/.test(why),
    "cites a clause and states the key stands");
}

console.log("\nThe registered names match real cases in the key");
const { execSync } = await import("node:child_process");
execSync("npx esbuild src/lib/seed.ts --bundle --format=cjs --platform=node --outfile=/tmp/fz.cjs", { stdio: "ignore" });
const { createRequire } = await import("node:module");
const S = createRequire(import.meta.url)("/tmp/fz.cjs");
const labels = new Set(S.EVAL_CASES.map(([l]) => l));
for (const [, name] of entries)
  t(`"${name.slice(0, 44)}" exists in the golden set`, labels.has(name),
    labels.has(name) ? "" : "a dispute registered against a case that does not exist would silently do nothing");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
