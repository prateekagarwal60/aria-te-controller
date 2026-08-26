// Prove an existing database survives the update: apply the new schema over a
// database that already holds worked cases and check nothing is lost.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const sql = async (strings, ...vals) => {
  if (typeof strings === "string") {
    if (/^\s*(create|alter|drop|truncate)/i.test(strings)) { await db.exec(strings); return []; }
    return (await db.query(strings, vals)).rows;
  }
  let text = "", i = 0;
  for (const s of strings) { text += s; if (i < vals.length) text += `$${++i}`; }
  return (await db.query(text, vals)).rows;
};
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

// The schema as it was before this round of changes.
const oldDDL = fs.readFileSync("src/lib/schema.ts", "utf8")
  .replace(/alter table escalations add column if not exists aria_verdict text/, "select 1")
  .replace(/auto_reject_limit    numeric\(14,2\) not null default 50000/, "auto_reject_limit    numeric(14,2) not null default 5000");
for (const m of [...oldDDL.matchAll(/`([\s\S]*?)`,\n/g)]) await db.exec(m[1]);

// A database that has been used: onboarded, charges worked, an escalation resolved.
await sql`insert into company (id, name, onboarded_at) values (1, 'Meridian', now())`;
await sql`insert into authority (id) values (1)`;
await sql`insert into employees (id,name,email,grade,department,cost_center) values ('E-1','A Rao','a@x.com','M4','Sales','CC-SAL')`;
await sql`insert into cost_centers (code,name) values ('CC-SAL','Sales')`;
await sql`insert into gl_accounts (code,name,type) values ('6130','Meals','expense')`;
await sql`insert into policy_versions (version, body, note) values (1,'# Policy 4.1 cap 9000','seed')`;
await sql`insert into transactions (id,employee_id,merchant,amount,currency,amount_inr,txn_date,source)
  values ('X-1','E-1','Taj',9400,'INR',9400,'2026-08-04','card_feed')`;
await sql`insert into cases (id,transaction_id,status,verdict,confidence,amount_allowed,risk_band,risk_score)
  values ('CASE-1','X-1','settled','PARTIAL',0.88,9000,'LOW',3)`;
await sql`insert into escalations (case_id, reason, question, recommendation, status, human_decision, human_rationale)
  values ('CASE-1','over limit','confirm?','allow to cap','resolved','APPROVE','fine')`;
await sql`insert into precedents (escalation_id, category, situation, decision, rationale)
  values (1,'hotels','over cap','APPROVE','allow to the cap')`;
await sql`insert into journal_entries (case_id, entry_ref) values ('CASE-1','JE-001')`;
await sql`insert into journal_lines (entry_id, account_code, cost_center, debit, credit) values (1,'6130','CC-SAL',9000,0)`;
await sql`insert into agent_runs (case_id, agent, model, input_tok, output_tok, latency_ms, cost_usd)
  values ('CASE-1','decide','claude',100,50,900,0.001)`;

const before = {};
for (const tb of ["cases","transactions","escalations","precedents","journal_entries","journal_lines","agent_runs","policy_versions","employees"])
  before[tb] = Number((await sql(`select count(*)::int as n from ${tb}`))[0].n);
const rejectBefore = Number((await sql`select auto_reject_limit from authority where id=1`)[0].auto_reject_limit);

// Now apply the current schema over the top, exactly as a page load would.
console.log("\nApplying the new schema over a database already in use");
const newDDL = fs.readFileSync("src/lib/schema.ts", "utf8");
try {
  for (const m of [...newDDL.matchAll(/`([\s\S]*?)`,\n/g)]) await db.exec(m[1]);
  t("applies without error", true);
} catch (e) { t("applies without error", false, e.message); }

console.log("\nNothing was lost");
for (const tb of Object.keys(before)) {
  const after = Number((await sql(`select count(*)::int as n from ${tb}`))[0].n);
  t(`${tb}`, after === before[tb], `${after} rows, unchanged`);
}

console.log("\nWorked outcomes are intact");
const c = (await sql`select * from cases where id='CASE-1'`)[0];
t("verdict kept", c.verdict === "PARTIAL");
t("allowed amount kept", Number(c.amount_allowed) === 9000);
t("status kept", c.status === "settled");
const je = (await sql`select entry_ref from journal_entries where case_id='CASE-1'`)[0];
t("the posted entry kept", je.entry_ref === "JE-001");
const pr = (await sql`select * from precedents limit 1`)[0];
t("the precedent kept", pr.decision === "APPROVE");

console.log("\nReview columns are added empty on charges settled before they existed");
{
  const c2 = (await sql`select * from cases where id='CASE-1'`)[0];
  t("reviewed_at added", "reviewed_at" in c2);
  t("review_agreed added", "review_agreed" in c2);
  t("an old charge counts as unchecked, not as agreed", c2.reviewed_at === null && c2.review_agreed === null);
}

console.log("\nThe new column exists and old rows simply have nothing in it");
const es = (await sql`select * from escalations limit 1`)[0];
t("aria_verdict column added", "aria_verdict" in es);
t("the old escalation has none", es.aria_verdict === null,
  "so it is left out of the overturn rate rather than counted wrongly");

console.log("\nAn existing setting is not overwritten by the new default");
const rejectAfter = Number((await sql`select auto_reject_limit from authority where id=1`)[0].auto_reject_limit);
t("the limit you had is still yours", rejectAfter === rejectBefore,
  `still ${rejectBefore}, the new default of 50000 applies only to a fresh install`);

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
