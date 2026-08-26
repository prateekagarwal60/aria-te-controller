// A gate on a number the model gives itself, which nothing has checked and which
// moves by as much as 0.2 on identical input, decides at random near the line.
// It is off unless a customer turns it on, and it is no longer put in front of
// anyone as something to act on.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nOff unless it is switched on");
const schema = fs.readFileSync("src/lib/schema.ts", "utf8");
t("the default is off", /min_confidence\s+numeric\(4,3\)\s+not null default 0,/.test(schema));
const ag = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("a floor of zero never fires", /Number\(a\.min_confidence\) > 0 && conf < Number\(a\.min_confidence\)/.test(ag));
t("and when it does fire it says whose setting it was", /floor you switched on/.test(ag));

// The gate, exercised directly.
const fires = (floor, conf) => Number(floor) > 0 && conf < Number(floor);
t("off lets a low score through", !fires(0, 0.4));
t("off lets a high score through", !fires(0, 0.95));
t("switched on, it bites below the line", fires(0.8, 0.78));
t("switched on, it does not bite above", !fires(0.8, 0.82));
t("switched on, it does not bite exactly on it", !fires(0.8, 0.8));

console.log("\nWhy it is off, held in the code so nobody turns it back on by accident");
t("it records that the number is the model's own", /a number the model gives itself/.test(ag));
t("it records the size of the movement", /0\.2 on identical input/.test(ag));
t("and that the same signal already exists in words", /says when she cannot decide, in words/.test(ag));

console.log("\nThe charge that prompted this");
/* Delhi hotel, 25,536. Deny limit 50,000, so the amount gates were clear. It
   escalated on a 0.78 against a 0.80 floor, having written a complete partial
   allowance with no hesitation in it. */
t("the amount would not have stopped it", 25536 < 50000);
t("only the floor did", fires(0.8, 0.78));
t("and with the floor off it settles", !fires(0, 0.78));

console.log("\nThe number is no longer put in front of anyone as something to act on");
const wp = fs.readFileSync("src/components/Workpaper.tsx", "utf8");
const shown = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");
t("not beside the decision", !/confidence \{Number\(adj\.confidence/.test(wp));
t("past rulings are shown there instead", /past ruling\$\{adj\.precedents_considered === 1/.test(wp));
for (const f of ["src/components/TrustStrip.tsx", "src/components/EvidenceFile.tsx"])
  t(`${f.split("/").pop()} does not display it`, !/confidence/i.test(shown(f)));

console.log("\nBut it is still recorded, and still measurable");
t("she is still asked for it", /"confidence": 0\.0-1\.0/.test(ag));
t("it is still stored on the charge", /confidence=\$\{adj\.confidence\}/.test(fs.readFileSync("src/app/api/step/route.ts", "utf8")));
t("and the review still measures what it is worth",
  /Is the confidence number worth anything/.test(fs.readFileSync("test/eval/run.mjs", "utf8")),
  "which is how you would earn the right to switch the floor on");

console.log("\nThe gates that remain are ones that can be read");
const block = ag.slice(ag.indexOf('if (mode === "shadow")'), ag.indexOf("const acted = reasons.length === 0;"));
for (const [what, re] of [
  ["she said she could not decide", /could not settle this on the record/],
  ["the checks found something serious", /at \$\{band\.toLowerCase\(\)\} risk/],
  ["more than she may allow", /More than she may allow on her own/],
  ["more than she may refuse", /More than she may refuse on her own/],
  ["a clause that is not in the policy", /not in your policy/],
]) t(`${what} still escalates`, re.test(block));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
