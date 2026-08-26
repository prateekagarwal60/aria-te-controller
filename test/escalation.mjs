// Two different events were stored the same way: she reached a view and needs
// agreement, and she reached none and needs a decision. Counting the second as an
// overturn made every answer read as a disagreement, so the figure was always 100%.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const step = fs.readFileSync("src/app/api/step/route.ts", "utf8");
const api = fs.readFileSync("src/app/api/escalations/route.ts", "utf8");
const page = fs.readFileSync("src/app/page.tsx", "utf8");

console.log("\nThe old arithmetic, shown failing");
const oldWay = (aria, human) => human !== aria;
t("answering a question counted as an overturn", oldWay("ESCALATE", "APPROVE"));
t("and so did the opposite answer", oldWay("ESCALATE", "REJECT"));
t("which is every possible answer, hence 100%",
  ["APPROVE", "PARTIAL", "REJECT"].every((h) => oldWay("ESCALATE", h)));

console.log("\nThe two kinds are now recorded apart");
t("a view she reached is permission", /const hasView = adj\.verdict && adj\.verdict !== "ESCALATE"/.test(step));
t("no view is a question", /const kind = hasView \? "permission" : "question"/.test(step));
t("no verdict is stored when she had none", /\$\{hasView \? adj\.verdict : null\}/.test(step));
t("and no proposed amount either", /\$\{hasView \? money\(adj\.amount_allowed \?\? txn\.amount_inr\) : null\}/.test(step));

console.log("\nOnly the ones where she had a view are scored");
t("the count filters on kind", /e\.kind === "permission" && e\.aria_verdict/.test(page));
const score = (rows) => {
  const withView = rows.filter((e) => e.kind === "permission" && e.aria_verdict);
  return { of: withView.length, changed: withView.filter((e) => e.human_decision !== e.aria_verdict).length };
};
t("a question is not counted at all",
  JSON.stringify(score([{ kind: "question", aria_verdict: null, human_decision: "APPROVE" }])) === JSON.stringify({ of: 0, changed: 0 }));
t("agreeing with a view she reached counts as agreement",
  JSON.stringify(score([{ kind: "permission", aria_verdict: "REJECT", human_decision: "REJECT" }])) === JSON.stringify({ of: 1, changed: 0 }));
t("changing one counts as a change",
  JSON.stringify(score([{ kind: "permission", aria_verdict: "REJECT", human_decision: "APPROVE" }])) === JSON.stringify({ of: 1, changed: 1 }));
t("a mixture reads correctly",
  JSON.stringify(score([
    { kind: "question", aria_verdict: null, human_decision: "APPROVE" },
    { kind: "permission", aria_verdict: "APPROVE", human_decision: "APPROVE" },
    { kind: "permission", aria_verdict: "REJECT", human_decision: "APPROVE" },
  ])) === JSON.stringify({ of: 2, changed: 1 }), "one question ignored, one agreed, one changed");

console.log("\nThe question asked matches which kind it is");
t("permission asks you to confirm or change", /Confirm it or decide differently/.test(step));
t("and says what she would do", /She would \$\{adj\.verdict === "APPROVE" \? "allow this in full"/.test(step));
t("a question says she cannot settle it", /cannot settle this/.test(step));
t("and asks what should happen", /What should happen\?/.test(step));

console.log("\nOne amount decides the outcome, so no button is ever wrong");
const outcome = (charged, allowed, decision) => {
  const a = decision === "REJECT" ? 0 : Math.max(0, Math.min(allowed ?? charged, charged));
  return a <= 0.01 ? "REJECT" : a >= charged - 0.01 ? "APPROVE" : "PARTIAL";
};
t("nothing allowed is a refusal", outcome(25536, 0, "REJECT") === "REJECT");
t("everything allowed is a full allowance", outcome(25536, 25536, "ALLOW") === "APPROVE");
t("part of it is a partial", outcome(25536, 20160, "ALLOW") === "PARTIAL");
t("leaving the box empty allows it all", outcome(25536, undefined, "ALLOW") === "APPROVE");
t("more than the charge is clamped", outcome(25536, 99999, "ALLOW") === "APPROVE");
t("the route derives it the same way", /allowed <= 0\.01 \? "REJECT" : allowed >= charged - 0\.01 \? "APPROVE" : "PARTIAL"/.test(api));
t("and stores what it derived", /human_decision=\$\{verdict\}/.test(api));
t("there is no partial button to press by mistake", !/Allow in part/.test(page));

console.log("\nA charge you ruled on is not one she settled alone");
t("state marks the ones a person ruled", /c\.decided_by_you = ruled\.has\(c\.id\)/.test(fs.readFileSync("src/app/api/state/route.ts", "utf8")));
t("the spot check is withheld on those",
  /\(c\.status === "settled" \|\| c\.status === "rejected"\) && !c\.decided_by_you/.test(fs.readFileSync("src/components/Workpaper.tsx", "utf8")));
t("and the header counts only what she settled alone", /!c\.decided_by_you\)/.test(page));

console.log("\nThe header says one thing about one thing");
t("it is about spot checks", /label="Checked by you"/.test(page));
t("not three events added together", !/spotDisagreed \+ overturned|overturned \+ spotDisagreed/.test(page));
t("and it prompts when nothing has been checked", /open one she settled and say if you agree/.test(page));

console.log("\nThe confidence floor no longer appears anywhere a customer looks");
t("no control for it", !/min_confidence: v/.test(page));
t("existing values are cleared", /update authority set min_confidence = 0 where min_confidence > 0/.test(fs.readFileSync("src/lib/schema.ts", "utf8")));

console.log("\nThe work log is gone from the workpaper");
t("not rendered there", !/Work log/.test(fs.readFileSync("src/components/Workpaper.tsx", "utf8")));
t("but the trace still holds it", /What she was asked to do/.test(fs.readFileSync("src/components/Trace.tsx", "utf8")));

console.log("\nThe outcome is settled once, before anything is written or learned from");
t("only one write of the decision", (api.match(/human_decision=\$\{/g) || []).length === 1,
  "it used to be written raw and then overwritten");
t("the stored value is the derived one", /human_decision=\$\{verdict\}/.test(api));
t("the record of the ruling carries the derived value", /decision: verdict, allowed, charged/.test(api));
t("and the precedent is told the same thing", /controller_decision: verdict/.test(api),
  "it used to be handed the raw button value, which is not one of the three it chooses from");
t("with the amounts it is generalising from", /controller_allowed: allowed/.test(api) && /charge_total: charged/.test(api));
t("the outcome is computed before the first write",
  api.indexOf("const verdict =") < api.indexOf("update escalations set status='resolved'"));
t("and before the precedent is generated",
  api.indexOf("const verdict =") < api.indexOf("controller_decision: verdict"));
t("a partial is named as an ordinary answer in the prompt",
  /an ordinary answer rather than a fudge/.test(api));

console.log("\nWhat the client sends still lines up with what the route expects");
t("the client sends a plain instruction", /resolve\(e, "ALLOW"\)/.test(page) && /resolve\(e, "REJECT"\)/.test(page));
t("and an amount alongside it", /amountAllowed: allowed/.test(page));
t("the route treats anything but REJECT as an allowance",
  /decision === "REJECT" \? 0/.test(api));
t("so the button label never has to match a stored value", !/resolve\(e, "PARTIAL"\)/.test(page));

console.log("\nRefusing to decide needs a named ground");
const ag2 = fs.readFileSync("src/lib/agents/index.ts", "utf8");
for (const g of ["no rule", "clauses conflict", "evidence contradicts", "figure missing"])
  t(`"${g}" is one of the grounds`, new RegExp(`"${g}"`).test(ag2));
t("the list is closed", /Nothing else qualifies/.test(ag2));
t("discomfort is explicitly not a ground",
  /An answer you dislike, a large amount/.test(ag2));
t("the reason is asked for alongside the flag", /"cannot_decide_because": string\|null/.test(ag2));

const GROUNDS = ["no rule", "clauses conflict", "evidence contradicts", "figure missing"];
const hedged = (flag, why) => flag && !GROUNDS.includes(String(why || "").toLowerCase());
t("a refusal with a listed ground is not a hedge", !hedged(true, "no rule"));
t("case does not matter", !hedged(true, "No Rule"));
t("a refusal with nothing named is a hedge", hedged(true, null));
t("a refusal with something invented is a hedge", hedged(true, "seems risky"));
t("deciding is never a hedge", !hedged(false, null));

t("a hedge is recorded rather than overridden", /logGuardrail\(caseId, "undeclared_hedge"/.test(ag2),
  "overriding a refusal to decide would be the dangerous direction");
t("the refusal still stands", !/json\.cannot_decide = false/.test(ag2));
t("and the console can name it", /Declined to decide without naming a reason/.test(page));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
