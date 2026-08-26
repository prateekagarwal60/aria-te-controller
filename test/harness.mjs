// The eval harness has to build the same input production builds. It did not,
// and twenty three cases failed for a reason that had nothing to do with the
// model. These assertions make that impossible to repeat without a red test.
import fs from "node:fs";
import { emptyEvidenceFile } from "../.evalbuild/agents.mjs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nThe shared evidence-file builder");
const f = emptyEvidenceFile();
t("has matched_receipt", "matched_receipt" in f);
t("has searched", "searched" in f);
for (const k of ["receipts", "calendar", "trips", "merchant_history"])
  t(`searched.${k}`, k in f.searched);
t("overrides apply", emptyEvidenceFile({ matched_receipt: { id: "R-1" } }).matched_receipt.id === "R-1");

console.log("\nThe harness uses it");
const src = fs.readFileSync("test/eval/run.mjs", "utf8");
const block = src.slice(src.indexOf("const assembled ="), src.indexOf("const investigation ="));
t("builds a file key", /file:\s*A\.emptyEvidenceFile/.test(block), "not a hand-rolled object");
t("populates matched_receipt when a receipt is supplied", /matched_receipt: payload\.receipt/.test(block));
t("leaves it null when none is", /:\s*null,?\s*\}\)/.test(block));

console.log("\nThe guardrail refuses a malformed file rather than escalating quietly");
const agents = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("throws when file is absent", /!\("file" in assembled\)[\s\S]{0,400}throw new Error/.test(agents));
t("the message names the fix", /emptyEvidenceFile\(\)/.test(
  agents.slice(agents.indexOf('!("file" in assembled)'), agents.indexOf('!("file" in assembled)') + 600)));

console.log("\nEvery caller of runDecide supplies a file");
for (const file of ["src/app/api/step/route.ts", "test/eval/run.mjs"]) {
  const s = fs.readFileSync(file, "utf8");
  if (!/runDecide\(/.test(s)) continue;
  const usesGather = /runGather\(/.test(s);
  const usesBuilder = /emptyEvidenceFile/.test(s);
  t(`${file}`, usesGather || usesBuilder,
    usesGather ? "via runGather" : usesBuilder ? "via emptyEvidenceFile" : "builds its own shape");
}

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
