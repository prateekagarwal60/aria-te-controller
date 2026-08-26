// The six checks are the whole trust surface. They are computed in code, so they
// get asserted in code. Every state a Controller could see is exercised here.
import { buildChecks, trustSummary } from "../.evalbuild/trust.mjs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const pick = (cs, k) => cs.find(x => x.key === k);

const base = (over = {}) => ({
  id: "CASE-1", merchant: "Hotel X", amount: 25536, amount_inr: 25536, currency: "INR",
  source: "card_feed", status: "settled",
  assembled: { file: { matched_receipt: null, searched: {
    receipts: { window: "2026-08-05 to 2026-09-02", days: 14, found: 0, candidates: [] },
    calendar: { window: "2026-08-17 to 2026-08-21", days: 2, found: 0, entries: [] },
    trips: { window: "2026-08-16 to 2026-08-22", days: 3, found: 0, entries: [] },
    merchant_history: { found: 0, entries: [] },
  } } },
  investigation: { risk_band: "LOW", risk_score: 8, findings: [], machine_signals: [{ code: "X" }] },
  adjudication: { verdict: "APPROVE", reasoning: "Fine.", clauses: [{ quote: "4.1 caps" }], citations_verified: true,
    evidence: { receipt_required: false, satisfied: true, note: "Below the threshold." } },
  authority: { acted: true, reasons: [] },
  closing: { entry_ref: "JE-001", balanced: true, totals: { debit: 25536, credit: 25536 } },
  ...over,
});

console.log("\nA charge that is fine reads as fine");
let cs = buildChecks(base());
t("six checks always", cs.length === 6);
t("no attention flags", cs.every(c => c.state !== "attention"), cs.map(c=>`${c.label}:${c.state}`).join(" "));
t("summary says so", trustSummary(cs).text === "all six clear", trustSummary(cs).text);

console.log("\nUnworked charge does not pretend to have checked anything");
cs = buildChecks(base({ adjudication: {}, investigation: {}, closing: {}, authority: {} }));
t("all pending", cs.every(c => c.state === "pending"));
t("summary says not run", trustSummary(cs).text === "not run");

console.log("\nA required receipt that is missing raises a flag");
cs = buildChecks(base({ adjudication: { ...base().adjudication, verdict: "ESCALATE",
  evidence: { receipt_required: true, requirement_clause: "9.1 requires a receipt above INR 2,000", satisfied: false } },
  status: "escalated", closing: {}, authority: { acted: false, reasons: ["No receipt."] } }));
t("receipt check flags", pick(cs,"evidence").state === "attention", pick(cs,"evidence").value);
t("it names the clause", /9\.1/.test(pick(cs,"evidence").detail || ""));
t("summary points at it", /receipt/i.test(trustSummary(cs).text), trustSummary(cs).text);

console.log("\nA receipt that is not required is not a flag");
cs = buildChecks(base());
t("shows as not required, not as a problem", pick(cs,"evidence").state === "none", pick(cs,"evidence").value);

console.log("\nAmounts that disagree surface");
cs = buildChecks(base({ assembled: { file: { ...base().assembled.file,
  matched_receipt: { id: "R-1", extracted: { total: 30000 } } } } }));
t("mismatch flagged", pick(cs,"amt").state === "attention", pick(cs,"amt").detail);
cs = buildChecks(base({ assembled: { file: { ...base().assembled.file,
  matched_receipt: { id: "R-1", extracted: { total: 25536 } } } } }));
t("match passes", pick(cs,"amt").state === "ok");
cs = buildChecks(base({ assembled: { file: { ...base().assembled.file,
  matched_receipt: { id: "R-1", extracted: { total: 25700 } } } } }));
t("within one percent tolerated", pick(cs,"amt").state === "ok", "25,700 vs 25,536");

console.log("\nCorroboration reflects what actually places the spend");
const withTrip = { ...base().assembled.file, searched: { ...base().assembled.file.searched,
  trips: { window: "w", days: 3, found: 1, entries: [{ id: "T-504", destination: "Delhi NCR", from: "2026-08-17", to: "2026-08-19", covers: true }] } } };
cs = buildChecks(base({ assembled: { file: withTrip } }));
t("a covering trip corroborates, and names the trip", pick(cs,"corr").state === "ok" && /T-504/.test(pick(cs,"corr").value),
  pick(cs,"corr").value);
cs = buildChecks(base());
t("a card charge with nothing else is neutral, not a flag", pick(cs,"corr").state === "none",
  pick(cs,"corr").value);
cs = buildChecks(base({ source: "employee_claim" }));
t("a claim with nothing else IS a flag", pick(cs,"corr").state === "attention",
  pick(cs,"corr").detail);

console.log("\nA correct refusal is not a flag");
cs = buildChecks(base({ adjudication: { ...base().adjudication, verdict: "REJECT", amount_disallowed: 9400 },
  status: "rejected", closing: {} }));
t("a disallowed charge does not flag the clause check", pick(cs,"pol").state === "ok", pick(cs,"pol").value);
t("and the outcome is still readable", pick(cs,"pol").value === "disallowed");
cs = buildChecks(base({ adjudication: { ...base().adjudication, verdict: "PARTIAL", amount_disallowed: 400 } }));
t("a partial allowance does not flag it either", pick(cs,"pol").state === "ok", pick(cs,"pol").value);
t("amber is reserved for something a human should look at",
  buildChecks(base({ adjudication: { ...base().adjudication, citations_verified: false } })).find(x=>x.key==="pol").state === "attention");

console.log("\nAn unverified citation always surfaces");
cs = buildChecks(base({ adjudication: { ...base().adjudication, citations_verified: false } }));
t("policy check flags", pick(cs,"pol").state === "attention", pick(cs,"pol").value);

console.log("\nRisk is arithmetic over the checks, not a model opinion");
const { scoreRisk } = await import("../.evalbuild/agents.mjs");
t("nothing fired scores zero", scoreRisk([]).score === 0 && scoreRisk([]).band === "LOW");
t("one high is high", scoreRisk([{severity:"high",code:"A"}]).score === 25 && scoreRisk([{severity:"high",code:"A"}]).band === "HIGH");
t("one medium is medium", scoreRisk([{severity:"medium",code:"A"}]).band === "MEDIUM", String(scoreRisk([{severity:"medium",code:"A"}]).score));
t("one low stays low", scoreRisk([{severity:"low",code:"A"}]).band === "LOW", String(scoreRisk([{severity:"low",code:"A"}]).score));
const lows = (n) => scoreRisk(Array.from({length:n},(_,i)=>({severity:"low",code:"L"+i})));
t("three weak checks stay low", lows(3).score === 9 && lows(3).band === "LOW", `${lows(3).score} points`);
t("four weak checks reach medium", lows(4).score === 12 && lows(4).band === "MEDIUM", `${lows(4).score} points`);
t("the boundary is where it says it is", scoreRisk([{severity:"medium",code:"A"}]).score === 10
  && scoreRisk([{severity:"high",code:"A"}]).score === 25, "medium at 10, high at 25");
t("info scores nothing", scoreRisk([{severity:"info",code:"A"}]).score === 0);
t("capped at 100", scoreRisk(Array(10).fill({severity:"high",code:"A"})).score === 100);
t("workings can be added up by hand", scoreRisk([{severity:"high",code:"DUP"},{severity:"low",code:"RND"}]).explain === "DUP 25 + RND 3 = 28",
  scoreRisk([{severity:"high",code:"DUP"},{severity:"low",code:"RND"}]).explain);

console.log("\nRisk bands map through");
for (const [band, want] of [["LOW","ok"],["MEDIUM","attention"],["HIGH","attention"]]) {
  cs = buildChecks(base({ investigation: { risk_band: band, risk_score: 50, findings: [], machine_signals: [] } }));
  t(`${band} risk reads ${want}`, pick(cs,"risk").state === want);
}

console.log("\nPosting reflects the money");
cs = buildChecks(base({ status: "rejected", closing: {} }));
t("disallowed has nothing to post", pick(cs,"post").state === "none");
cs = buildChecks(base({ status: "escalated", closing: {}, authority: { acted: false, reasons: ["Over limit."] } }));
t("escalated says who it waits on", pick(cs,"post").value === "waiting on you", pick(cs,"post").detail);

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
