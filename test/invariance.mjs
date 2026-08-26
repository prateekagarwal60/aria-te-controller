// Structural checks on the invariance suite. No API calls. Verifies the matrix
// actually discriminates: if strict and lenient expect the same verdict for a
// charge, the test proves nothing and should fail here rather than pass live.
import { POLICY_VARIANTS, INVARIANCE_MATRIX, NO_FIGURE_CHARGES } from "./eval/suites.mjs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nPolicy variants");
t("five variants", POLICY_VARIANTS.length === 5);
const byId = Object.fromEntries(POLICY_VARIANTS.map(p => [p.id, p]));
t("strict caps at 9,000", byId.strict.body.includes("INR 9,000"));
t("lenient caps at 15,000", byId.lenient.body.includes("INR 15,000"));
t("strict and lenient differ only in the figure", 
  byId.strict.body.replace(/9,000|6,500/g,"X") === byId.lenient.body.replace(/15,000|11,000/g,"X"));
t("exception variant adds 4.2 and keeps the 9,000 cap",
  byId.exception.body.includes("4.2") && byId.exception.body.includes("INR 9,000"));
t("silent variant says nothing about accommodation",
  !byId.silent.body.toLowerCase().includes("accommodation") && !byId.silent.body.includes("room rate"));
t("no_figures variant carries no accommodation figure",
  !/INR\s*[\d,]+/.test(byId.no_figures.body.split("## 4")[1] || ""));

console.log("\nThe matrix discriminates");
for (const m of INVARIANCE_MATRIX) {
  const e = m.expect;
  const distinct = new Set(Object.values(e)).size;
  t(`"${m.charge}" is not answered the same way by every policy`, distinct > 1,
    Object.entries(e).map(([k,v])=>`${k}:${v}`).join(" "));
}
const discriminating = INVARIANCE_MATRIX.filter(m => m.expect.strict !== m.expect.lenient);
t("at least one charge flips between strict and lenient", discriminating.length >= 1,
  `${discriminating.length} of ${INVARIANCE_MATRIX.length}`);
const exceptionFlips = INVARIANCE_MATRIX.filter(m => m.expect.strict !== m.expect.exception);
t("the sponsored-event exception changes an outcome", exceptionFlips.length >= 1,
  `${exceptionFlips.length} charge(s)`);
t("silence always escalates", INVARIANCE_MATRIX.every(m => m.expect.silent === "ESCALATE"));

console.log("\nCoverage");
t("every variant except no_figures is exercised",
  POLICY_VARIANTS.filter(p => p.id !== "no_figures").every(p => INVARIANCE_MATRIX.some(m => m.expect[p.id])));
t("no_figures has its own charges", NO_FIGURE_CHARGES.length >= 2);
const total = INVARIANCE_MATRIX.reduce((s,m)=>s+Object.keys(m.expect).length,0) + NO_FIGURE_CHARGES.length;
t("suite is worth running", total >= 12, `${total} assertions`);

console.log("\nA memorised default would fail this");
t("a fixed rule of 'reject over 9,000' fails the lenient column",
  INVARIANCE_MATRIX.some(m => m.payload.amount_inr > 9000 && m.expect.lenient === "APPROVE"));
t("a fixed rule of 'approve under 15,000' fails the strict column",
  INVARIANCE_MATRIX.some(m => m.payload.amount_inr < 15000 && m.expect.strict !== "APPROVE"),
  "PARTIAL and REJECT both count: neither is a full allowance");
t("all four outcomes appear somewhere in the matrix", (() => {
  const seen = new Set(INVARIANCE_MATRIX.flatMap(m => Object.values(m.expect)));
  return ["APPROVE","PARTIAL","REJECT","ESCALATE"].every(v => seen.has(v));
})(), [...new Set(INVARIANCE_MATRIX.flatMap(m => Object.values(m.expect)))].join(" "));
t("one charge is disallowed outright under every rulebook that has a rule",
  INVARIANCE_MATRIX.some(m => m.expect.strict === "REJECT" && m.expect.lenient === "REJECT"),
  "a cap cannot be the only thing being tested");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
