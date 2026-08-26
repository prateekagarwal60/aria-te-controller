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
