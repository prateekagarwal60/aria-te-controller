// "Settled without you: 78%" is a claim with nothing behind it unless the product
// can say why those charges can be left alone, and unless a human can test it.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const page = fs.readFileSync("src/app/page.tsx", "utf8");
const wp = fs.readFileSync("src/components/Workpaper.tsx", "utf8");
const api = fs.readFileSync("src/app/api/review/route.ts", "utf8");

console.log("\nThe charges nobody opened are accounted for");
/* Four lines of checks became two sentences. The claim is unchanged and the
   noise is gone: three stacked paragraphs read as an argument rather than a
   summary, and one of them contradicted another. */
t("it says how many she settled alone", /\{own\.length\} settled without you/.test(page));
t("counts only what she settled herself",
  /x\.status === "settled" \|\| x\.status === "rejected"/.test(page));
t("and what still needs a person", /\{counts\.escalated\} need you/.test(page));
t("every one rests on a real clause and a balanced entry",
  /Each quotes a clause and balances/.test(page));
t("computed from both, not asserted",
  /citations_verified !== false &&/.test(page) && /x\.closing\?\.balanced/.test(page));
t("a refusal is not expected to have posted an entry",
  /x\.status === "rejected" \|\| x\.closing\?\.balanced/.test(page));
t("it says plainly when not all of them qualify",
  /\$\{sound\} of \$\{own\.length\} quote a clause/.test(page));

// The arithmetic, run directly.
const sound = (rows) => rows.filter((x) =>
  x.adjudication?.citations_verified !== false &&
  (x.status === "rejected" || x.closing?.balanced)).length;
t("a settled charge with a verified clause and a balanced entry counts",
  sound([{ status: "settled", adjudication: { citations_verified: true }, closing: { balanced: true } }]) === 1);
t("a refusal counts without an entry",
  sound([{ status: "rejected", adjudication: { citations_verified: true } }]) === 1,
  "a correct refusal used to drag the whole line to zero");
t("an unverified clause does not count",
  sound([{ status: "settled", adjudication: { citations_verified: false }, closing: { balanced: true } }]) === 0);
t("an unbalanced entry does not count",
  sound([{ status: "settled", adjudication: { citations_verified: true }, closing: { balanced: false } }]) === 0);

console.log("\nAnd a human can test the claim");
t("a settled charge can be checked", /I would have decided the same/.test(wp));
t("and disagreed with", /I would not/.test(wp));
t("disagreement needs a reason", /disabled=\{reviewing \|\| !reviewNote\.trim\(\)\}/.test(wp));
t("only on charges she settled herself",
  /c\.status === "settled" \|\| c\.status === "rejected"/.test(wp));
t("agreement is recorded as firmly as disagreement", /review_agreed = \$\{!!agreed\}/.test(api));
t("both go in the tamper-evident log",
  /appendDecision\(caseId, agreed \? "review_agreed" : "review_disagreed"/.test(api));
t("disagreement reopens it through the normal route",
  /insert into escalations/.test(api) && /status = 'escalated'/.test(api));
t("and records what she had decided", /aria_verdict/.test(api), "so the reversal is attributable");
t("checking twice does not open two", /select id from escalations where case_id = \$\{caseId\} and status = 'open'/.test(api));

console.log("\nThe header counts one thing, not three added together");
/* It used to add answering a question she could not settle, changing a view she
   had reached, and disagreeing with something she settled. Three different
   events, one number, unreadable. */
const fn = page.slice(page.indexOf("const settledAlone ="), page.indexOf("const minutes ="));
t("it counts only what she settled on her own", /!c\.decided_by_you\)/.test(fn));
t("how many of those you have checked", /spotChecked = settledAlone\.filter/.test(fn));
t("and whether you disagreed", /spotDisagreed = settledAlone\.filter/.test(fn));
t("nothing is added to anything else", !/\+ overturned|overturned \+/.test(fn));
t("it prompts rather than reading zero", /open one she settled and say if you agree/.test(fn));

const checked = (rows) => {
  const alone = rows.filter((c) => (c.status === "settled" || c.status === "rejected") && !c.decided_by_you);
  return { of: alone.length,
           done: alone.filter((c) => c.reviewed_at).length,
           against: alone.filter((c) => c.reviewed_at && c.review_agreed === false).length };
};
t("a charge you ruled on is not counted",
  checked([{ status: "settled", decided_by_you: true, reviewed_at: 1 }]).of === 0);
t("one she settled and you checked counts",
  JSON.stringify(checked([{ status: "settled", reviewed_at: 1, review_agreed: true }])) === JSON.stringify({ of: 1, done: 1, against: 0 }));
t("a disagreement is counted separately",
  checked([{ status: "settled", reviewed_at: 1, review_agreed: false }]).against === 1);
t("unchecked ones are in the denominator, not the numerator",
  JSON.stringify(checked([{ status: "settled" }, { status: "settled", reviewed_at: 1, review_agreed: true }])) === JSON.stringify({ of: 2, done: 1, against: 0 }));

console.log("\nNothing is projected that has not happened");
const shown = page.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");
t("no forecast beside the measured figures",
  !/could recover|potential|estimated recovery|projected/i.test(shown));
t("time is the only assumption and it is labelled",
  /at \$\{MINUTES_A_CHARGE\} minutes a charge/.test(shown));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
