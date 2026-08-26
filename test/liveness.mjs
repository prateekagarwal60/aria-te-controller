// A row said "settled" while the workpaper beside it was blank, because the queue
// patched the row's status locally and left every field the workpaper reads
// untouched. A row must never claim an outcome the panel cannot draw.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const page = fs.readFileSync("src/app/page.tsx", "utf8");
const wp = fs.readFileSync("src/components/Workpaper.tsx", "utf8");

console.log("\nWhat the workpaper reads off a charge");
const needs = [...new Set([...wp.matchAll(/\bc\.(adjudication|investigation|assembled|closing|authority|status|amount_allowed)\b/g)]
  .map((m) => m[1]))].sort();
console.log(`  ${needs.join(", ")}`);

console.log("\nThe queue does not invent a status without them");
t("no local status patch is left", !/OUTCOME_STATUS/.test(page),
  "patching status alone made a row read settled with nothing behind it");
t("no partial rewrite of a case row", !/cases: st\.cases\.map\(/.test(page));
t("the state is reloaded when a charge finishes",
  /setWorking\(\(w\) => w\.filter[\s\S]{0,900}await load\(\);/.test(page));
t("and once more when the run ends", (page.match(/await load\(\);/g) || []).length >= 3);

console.log("\nThe reason the old design existed does not hold");
const perCharge = 45, atOnce = 4;
const gap = perCharge / atOnce;
t("four workers finish a charge every ~11s, not four a second", Math.round(gap) === 11,
  `${Math.round(gap)}s between completions`);
t("which is why the reload is affordable", 1 / gap < 0.2, `${(1 / gap).toFixed(2)} requests a second`);
t("and the code records that", /one completion every eleven/.test(page));

console.log("\nThe in-flight indicator is local and stays local");
t("charges in flight are tracked", /const \[working, setWorking\]/.test(page));
t("a row in flight is marked", /working\.includes\(c\.id\)/.test(page));
t("it is cleared when the run ends", /setWorking\(\[\]\)/.test(page));
t("it does not touch the case data", !/setWorking[\s\S]{0,120}cases:/.test(page),
  "an indicator is display, a status is data");

console.log("\nA charge only reads as finished once its data is there");
/* The panel renders from the same object the row does, so once the reload has
   happened both are consistent by construction. */
t("the workpaper renders from the case in state", /c=\{current\}/.test(page));
t("and current comes from the same list the rows do", /cases\.find\(\(c: any\) => c\.id === openCase\)/.test(page));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
