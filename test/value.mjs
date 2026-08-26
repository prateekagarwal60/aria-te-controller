// What the header leads with decides what a customer compares the product to.
// Cost per charge invites cost-plus pricing against an inference bill. These
// assert the headline is what she saved, and that cost survives only as a control.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const page = fs.readFileSync("src/app/page.tsx", "utf8");
/* Comments explain why a claim is absent and would otherwise trip the check
   looking for that claim. Strip them before testing what a customer can read. */
const shown = page.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

console.log("\nThe headline is what she saved");
for (const label of ["Worked", "Settled without you", "Waiting on you", "Spend she stopped", "Your time back"])
  t(`shows "${label}"`, new RegExp(`label="${label}"`).test(page));
t("no running cost in the header", !/label="Her running cost/.test(page));
t("no call latency in the header", !/label="Median call"/.test(page));

console.log("\nMoney stopped is measured, not assumed");
const fn = page.slice(page.indexOf("const stopped_spend"), page.indexOf("const minutes ="));
t("counts only charges she settled herself", /status !== "settled" && c\.status !== "rejected"/.test(fn));
t("a refusal counts the whole charge", /c\.status === "rejected" \? 0/.test(fn));
t("a partial counts the difference", /charged - allowed/.test(fn));
t("never negative", /Math\.max\(0,/.test(fn));

// Same arithmetic, checked directly.
const stopped = (rows) => rows.reduce((sum, c) => {
  if (c.status !== "settled" && c.status !== "rejected") return sum;
  const charged = Number(c.amount_inr || 0);
  const allowed = c.status === "rejected" ? 0 : Number(c.amount_allowed ?? charged);
  return sum + Math.max(0, charged - allowed);
}, 0);
t("a full allowance stops nothing",
  stopped([{ status: "settled", amount_inr: 9400, amount_allowed: 9400 }]) === 0);
t("a partial stops the difference",
  stopped([{ status: "settled", amount_inr: 25536, amount_allowed: 20160 }]) === 5376);
t("a refusal stops the whole charge",
  stopped([{ status: "rejected", amount_inr: 18000 }]) === 18000);
t("an open escalation counts for nothing yet",
  stopped([{ status: "escalated", amount_inr: 18000, amount_allowed: 0 }]) === 0);
t("they add up",
  stopped([{ status: "settled", amount_inr: 25536, amount_allowed: 20160 },
           { status: "rejected", amount_inr: 18000 },
           { status: "escalated", amount_inr: 5000 }]) === 23376);

console.log("\nTime is an assumption and is labelled as one");
t("the assumption is a named constant", /const MINUTES_A_CHARGE = 6/.test(page));
t("it is printed beside the figure", /at \$\{MINUTES_A_CHARGE\} minutes a charge/.test(page));
t("counted only on charges she settled", /\(counts\.settled \+ counts\.rejected\) \* MINUTES_A_CHARGE/.test(page));

console.log("\nCost survives as a control, not a price");
t("still capped under Controls", /daily running budget/i.test(page));
t("described as a brake", /a brake, not a bill/.test(page));
t("warns only when close to the limit", /Number\(g\.spentToday\) > Number\(g\.cap\) \* 0\.8/.test(page));
t("and says so plainly when it stops her", /reached her daily running budget and has stopped/.test(page));

console.log("\nNo per-charge price is shown anywhere a customer looks");
for (const f of ["src/components/Workpaper.tsx", "src/components/Trace.tsx", "src/components/EvidenceFile.tsx"]) {
  const s = fs.readFileSync(f, "utf8");
  t(`${f.split("/").pop()} shows no dollar figure`, !/\$\{?\s*Number\(r\.cost_usd\)|cost_usd\)\.toFixed/.test(s));
}

console.log("\nEvery escalation reason reads as a sentence, not a setting");
const ag = fs.readFileSync("src/lib/agents/index.ts", "utf8");
const block = ag.slice(ag.indexOf("if (mode === \"shadow\")"), ag.indexOf("const acted = reasons.length === 0;"));
const pushed = [...block.matchAll(/reasons\.push\(\s*[`"]([^`"]+)/g)].map((m) => m[1]);
t("nine reasons", pushed.length === 9, `${pushed.length}`);
for (const r of pushed) {
  const startsUpper = /^[A-Z]/.test(r);
  const hasVerb = /\b(is|was|could|may|quoted|turned|reached|comes|records)\b/.test(r);
  t(`"${r.slice(0, 46)}…"`, startsUpper && hasVerb, startsUpper ? "" : "does not start as a sentence");
}
t("none of them recites a threshold comparison",
  !pushed.some((r) => /is below the|at or above the .* threshold|exceeds the INR/.test(r)));
t("but they still name the setting to change",
  pushed.filter((r) => /your |you set|you asked/.test(r)).length >= 4);

console.log("\nWhat is waiting carries its own weight");
t("the escalation count shows the money at stake", /\$\{inr\(waiting_value\)\} at stake/.test(page));
const waitVal = (rows) => rows.reduce((sum, c) => c.status === "escalated" ? sum + Number(c.amount_inr || 0) : sum, 0);
t("counts only what is open", waitVal([{ status: "escalated", amount_inr: 18000 },
  { status: "settled", amount_inr: 9400 }]) === 18000);
t("four small ones read differently from four large ones",
  waitVal([{ status: "escalated", amount_inr: 500 }]) !== waitVal([{ status: "escalated", amount_inr: 500000 }]));

console.log("\nNothing is called fraud, because nothing has been confirmed as fraud");
t("no fraud claim anywhere a customer looks",
  !/fraud (caught|found|detected|prevented)/i.test(shown), "we have no ground truth for it");
t("no count of suspicions dressed as findings",
  !/had something serious enough/.test(shown),
  "it overlapped with the flagged count and read as two figures for one thing");

console.log("\nCoverage is one clause, not a paragraph");
t("stated once everything has been worked", /read in full, where a person reviewing by hand would sample a tenth/.test(page));
t("held back while charges are still unrun", /counts\.queued === 0 && \(/.test(page));
t("not a header stat", !/label="Coverage"/.test(page));

console.log("\nRecovery shows only the slice that is real");
t("input tax appears on the ledger", /input tax split out and claimable/.test(page));
t("computed from the posted entries", /r\.type === "tax"/.test(page) && /Number\(r\.debit \|\| 0\)/.test(page));
t("hidden when there is none", /if \(tax <= 0\) return null/.test(page));
t("no claim about recovery that is not built",
  !/recovery captured|unused ticket|duplicate payment/i.test(shown));

console.log("\nMetrics that would have been fabricated here are absent");
t("no days to close", !/days to close/i.test(shown), "seeded charges all closed minutes apart");
t("no escalation precision in the header", !/label="Escalation precision"/.test(page),
  "it needs resolved escalations and would sit blank");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
