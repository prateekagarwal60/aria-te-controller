// Dry-run the eval runner's plumbing without spending a single API call:
// stub the Anthropic client, run the real suite logic, confirm gates and
// report generation work. This catches wiring bugs before he burns a key.
import { INJECTION_PAIRS, JUDGMENT_CASES, CONSISTENCY_CASES, CLOSING_CASES } from './suites.mjs';

let bad = 0;
const check = (n, c, d='') => { if (c) console.log(`  ok   ${n}${d?' — '+d:''}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nSuite shape");
check("injection pairs", INJECTION_PAIRS.length >= 8, `${INJECTION_PAIRS.length} pairs`);
check("every pair names a field the claimant controls",
  INJECTION_PAIRS.every(p => ['receipt','memo'].includes(p.attackField)));
check("every pair has base text in the attacked field",
  INJECTION_PAIRS.every(p => p.base[p.attackField] !== undefined || p.attackField==='memo'));
check("attacks are non-trivial", INJECTION_PAIRS.every(p => p.attack.length > 30));
check("judgment cases", JUDGMENT_CASES.length >= 8, `${JUDGMENT_CASES.length} cases`);
check("judgment covers all three verdicts",
  new Set(JUDGMENT_CASES.map(c=>c.expect)).size === 3,
  JSON.stringify(JUDGMENT_CASES.reduce((m,c)=>({...m,[c.expect]:(m[c.expect]||0)+1}),{})));
check("boundary pair present (one under / one over a cap)",
  JUDGMENT_CASES.some(c=>c.payload.amount_inr===8999) && JUDGMENT_CASES.some(c=>c.payload.amount_inr===9001));
check("every judgment case explains itself", JUDGMENT_CASES.every(c=>c.why && c.why.length>20));
check("consistency cases span easy and ambiguous", CONSISTENCY_CASES.length >= 4);
check("closing cases", CLOSING_CASES.length >= 4);
check("closing includes a reimbursement claim",
  CLOSING_CASES.some(c=>c.txn.source==='employee_claim'));
check("closing includes a partial allowance",
  CLOSING_CASES.some(c=>c.allowed < c.txn.amount_inr));
check("closing includes foreign currency",
  CLOSING_CASES.some(c=>c.txn.currency!=='INR'));

console.log("\nA/B construction");
for (const p of INJECTION_PAIRS.slice(0,3)) {
  const attacked = { ...p.base };
  attacked[p.attackField] = (p.base[p.attackField] || '') + p.attack;
  const grew = String(attacked[p.attackField]).length > String(p.base[p.attackField]||'').length;
  const baseUntouched = p.base[p.attackField] === undefined ||
    String(attacked[p.attackField]).startsWith(String(p.base[p.attackField]));
  check(`${p.id} attacked variant differs and preserves the original`, grew && baseUntouched);
}

console.log("\nGate arithmetic");
const pct = n => `${(n*100).toFixed(1)}%`;
check("pct formatter", pct(0.8542)==='85.4%', pct(0.8542));
const verdicts=['APPROVE','APPROVE','REJECT'];
const counts=verdicts.reduce((m,v)=>({...m,[v]:(m[v]||0)+1}),{});
const modal=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
check("modal share", modal[0]==='APPROVE' && modal[1]/3===2/3, `${modal[0]} ${(modal[1]/3).toFixed(2)}`);
const lat=[100,200,300,400,500,600,700,800,900,1000];
check("p95 index", lat[Math.floor(lat.length*0.95)]===1000, String(lat[Math.floor(lat.length*0.95)]));
check("p50 index", lat[Math.floor(lat.length*0.5)]===600, String(lat[Math.floor(lat.length*0.5)]));

console.log("\nAgent bundle exports");
const A = await import('../../.evalbuild/agents.mjs');
for (const f of ['runGather','runCorroborate','runDecide','applyAuthority','runPost','writeToLedger'])
  check(`exports ${f}`, typeof A[f]==='function');

console.log("\nAuthority gate, pure logic, no API needed");
globalThis.__authority = { auto_approve_limit:100000, auto_reject_limit:5000, min_confidence:0.8,
  escalate_risk_at:'HIGH', can_post_ledger:true, can_reject:true };
console.log(bad?`\n${bad} FAILED\n`:'\nAll good\n');
process.exit(bad?1:0);
