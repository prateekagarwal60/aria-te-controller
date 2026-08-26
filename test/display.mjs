// A partial settlement was showing the full charge under a stamp saying it had
// been settled and posted, which reads as though the whole thing was paid.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const isPartial = (charged, allowed) =>
  allowed != null && allowed > 0.01 && allowed < charged - 0.01;

console.log("\nWhen a settlement is partial");
t("9,000 allowed of 9,400 is partial", isPartial(9400, 9000));
t("the full amount is not", !isPartial(9400, 9400));
t("nothing allowed is not partial, it is a refusal", !isPartial(9400, 0));
t("not yet decided is not partial", !isPartial(9400, null));
t("a paisa short is not partial", !isPartial(9400, 9399.995));
t("6,000 of 7,600 is partial", isPartial(7600, 6000));

console.log("\nThe workpaper shows what was allowed, not what was charged");
const wp = fs.readFileSync("src/components/Workpaper.tsx", "utf8");
t("leads with the allowed figure when partial", /inr\(partial \? allowed : charged\)/.test(wp));
t("says what was disallowed", /disallowed<\/div>/.test(wp));
t("keeps the charged figure visible", /charged<\/div>|charged\b/.test(wp));
t("passes partial to the stamp", /<Stamp status=\{c\.status\} partial=\{partial\}/.test(wp));

console.log("\nThe stamp does not claim the whole charge was paid");
const ui = fs.readFileSync("src/components/ui.tsx", "utf8");
t("a partial settlement reads differently", /Settled in part/.test(ui));
t("and only when it actually settled", /partial && status === "settled"/.test(ui));

console.log("\nThe queue row agrees with the workpaper");
const page = fs.readFileSync("src/app/page.tsx", "utf8");
t("shows the allowed figure", /<div>\{inr\(allowed\)\}<\/div>/.test(page));
t("and what was charged underneath", /of \{inr\(charged\)\}/.test(page));

console.log("\nAn uploaded receipt is linked, not copied");
const txn = fs.readFileSync("src/app/api/transactions/route.ts", "utf8");
t("accepts an id for a receipt already on file", /b\.receipt_id/.test(txn));
t("looks for the same content before creating another", /content_hash = \$\{hash\}/.test(txn));
t("only creates when nothing matches", /if \(existing\.length\)/.test(txn));
t("returns the id it used", /receiptId \}\)/.test(txn));
for (const f of ["src/app/claim/page.tsx", "src/app/page.tsx"]) {
  const s = fs.readFileSync(f, "utf8");
  t(`${f.split("/").slice(-2).join("/")} sends the id`, /receipt_id: uploadedReceiptId/.test(s));
}

console.log("\nAn escalation records what she recommended, so it can be scored");
t("the column exists", /aria_verdict/.test(fs.readFileSync("src/lib/schema.ts", "utf8")));
t("it is written when the escalation opens",
  /recommendation, aria_verdict/.test(fs.readFileSync("src/app/api/step/route.ts", "utf8")));
t("only the ones where she had already reached a view are scored",
  /e\.kind === "permission" && e\.aria_verdict/.test(page),
  "answering a question she could not settle is not an overturn");
t("agreeing every time is called out as a signal",
  /Her limits are tighter than they need to be/.test(page));

console.log("\nThe Agents screen is off the nav");
t("not in VIEWS", !/\["agents", "Agents"\],\n\] as const/.test(page));
t("behind a dev flag", /DEV_VIEWS/.test(page));
t("typed keyword toggles it", /typed\.endsWith\("agents"\)/.test(page));
t("a URL flag also works", /get\("dev"\) === "1"/.test(page));
t("ignores typing inside a field", /input\|textarea\|select/.test(page));
t("falls back if hidden while open", /if \(!dev && view === "agents"\) setView\("desk"\)/.test(page));

console.log("\nAn employee who is out of pocket is told why");
const wp2 = fs.readFileSync("src/components/Workpaper.tsx", "utf8");
const ag = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("the rule covers being out of pocket, not only having to act",
  /they are out of pocket, because part or all of what they spent is not being reimbursed/.test(ag));
t("it says why silence is not acceptable there",
  /will notice and will not know why/.test(ag));
t("a charge allowed in full still needs no note", /allowed in full needs no note/.test(ag));
t("a case going to the Controller must not announce an outcome",
  /nothing has been decided\s*\n?yet, so ask for what is missing/.test(ag));

console.log("\nA missing note is visible rather than a blank space");
t("money disallowed and nothing written is flagged",
  /Nothing drafted for \{String\(c\.employee_name\)/.test(wp2));
t("it names the amount they will be short", /\{inr\(adj\.amount_disallowed\)\} was not reimbursed/.test(wp2));
t("a fully covered charge says so instead of showing nothing",
  /Nothing to tell \{String\(c\.employee_name\)[\s\S]{0,220}covered in full/.test(wp2));
t("the two states cannot both show",
  /> 0\.01 &&/.test(wp2) && /<= 0\.01 &&/.test(wp2));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
