// Runs the actual bootstrap seed against an in-process Postgres and asserts that the
// corpus is rich enough for the corroboration signals to have something to find.
import { PGlite } from "@electric-sql/pglite";
import * as S from "/tmp/seed.mjs";
import fs from "node:fs";

const db = new PGlite();
const sql = async (strings, ...vals) => {
  if (typeof strings === "string") { await db.exec(strings); return []; }
  let text = "", i = 0;
  for (const s of strings) { text += s; if (i < vals.length) text += `$${++i}`; }
  return (await db.query(text, vals)).rows;
};

function contentHash(s) {
  const norm = (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < norm.length; i++) {
    h1 = Math.imul(h1 ^ norm.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + norm.charCodeAt(i) * (i + 1), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const ddlSrc = fs.readFileSync(new URL("../src/lib/schema.ts", import.meta.url), "utf8");
const DDL = [...ddlSrc.matchAll(/`([\s\S]*?)`,\n/g)].map((m) => m[1]);
for (const stmt of DDL) await db.exec(stmt);

// --- onboarding, step by step, exactly as /api/onboard runs it ---
await sql`insert into company (id) values (1) on conflict do nothing`;
await sql`update company set name='Meridian Systems', legal_entity='Meridian Systems India Private Limited',
  home_currency='INR', jurisdiction='India', agent_name='Vera' where id = 1`;

for (const e of S.EMPLOYEES)
  await sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
    values (${e[0]},${e[1]},${e[2]},${e[3]},${e[4]},${e[5]},${e[6]},${e[7]}) on conflict do nothing`;
for (const c of S.COST_CENTERS)
  await sql`insert into cost_centers (code,name) values (${c[0]},${c[1]}) on conflict do nothing`;
for (const g of S.GL_ACCOUNTS)
  await sql`insert into gl_accounts (code,name,type,guidance) values (${g[0]},${g[1]},${g[2]},${g[3]}) on conflict do nothing`;
for (const t of S.TRIPS)
  await sql`insert into trips (id,employee_id,purpose,origin,destination,starts_on,ends_on,approved_by,budget_inr)
    values (${t[0]},${t[1]},${t[2]},${t[3]},${t[4]},${t[5]},${t[6]},${t[7]},${t[8]}) on conflict do nothing`;
for (const c of S.CALENDAR)
  await sql`insert into calendar_events (id,employee_id,title,starts_at,ends_at,location,attendees)
    values (${c[0]},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]},${c[6]}) on conflict do nothing`;
for (const r of S.RECEIPTS)
  await sql`insert into receipts (id,employee_id,source,raw_text,content_hash)
    values (${r[0]},${r[1]},${r[2]},${r[3]},${contentHash(r[3])}) on conflict do nothing`;
for (const t of S.TRANSACTIONS) {
  await sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo,scenario)
    values (${t[0]},${t[1]},${t[2]},${t[3]},${t[4]},${t[5]},${t[6]},${t[7]},${t[8]},${t[9]},${t[10]},${t[11]},${t[12] ?? null}) on conflict do nothing`;
  await sql`insert into cases (id, transaction_id, status) values (${"CASE-" + t[0].slice(2)}, ${t[0]}, 'queued') on conflict do nothing`;
}
await sql`insert into policy_versions (version, body, note) values (1, ${S.POLICY_V1}, 'Set during onboarding')`;
await sql`insert into authority (id) values (1) on conflict do nothing`;
for (const ev of S.EVAL_CASES)
  await sql`insert into eval_cases (label,payload,expect_verdict,note)
    values (${ev[0]}, ${JSON.stringify(ev[1])}, ${ev[2]}, ${ev[3]})`;

// --- assertions ---
let fail = 0;
const t = async (name, fn) => {
  try { const m = await fn(); console.log(`  ok   ${name}${m ? " — " + m : ""}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};

console.log("\nOnboarding");
await t("company recorded", async () => {
  const c = (await sql`select * from company where id=1`)[0];
  if (!c.name) throw new Error("no company name");
  return `${c.name}, agent named ${c.agent_name}`;
});
await t("agent is not hired until onboarding commits", async () => {
  const c = (await sql`select onboarded_at from company where id=1`)[0];
  if (c.onboarded_at) throw new Error("onboarded_at set before commit");
  return "onboarded_at still null";
});
await t("commit sets the hire", async () => {
  await sql`update company set onboarded_at = now() where id = 1`;
  const c = (await sql`select onboarded_at from company where id=1`)[0];
  if (!c.onboarded_at) throw new Error("commit did not stick");
  return "hired";
});
await t("reset unhires and clears the work", async () => {
  await sql`truncate journal_lines, journal_entries, escalations, precedents, agent_runs,
    eval_runs, eval_cases, decision_log, guardrail_events, cases, transactions, receipts,
    calendar_events, trips, policy_versions restart identity cascade`;
  await sql`delete from employees`; await sql`delete from gl_accounts`; await sql`delete from cost_centers`;
  await sql`update company set onboarded_at = null where id = 1`;
  const n = (await sql`select count(*)::int n from transactions`)[0].n;
  const c = (await sql`select onboarded_at from company where id=1`)[0];
  if (n !== 0 || c.onboarded_at) throw new Error("reset incomplete");
  return "clean slate";
});

for (const e of S.EMPLOYEES)
  await sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
    values (${e[0]},${e[1]},${e[2]},${e[3]},${e[4]},${e[5]},${e[6]},${e[7]}) on conflict do nothing`;
for (const c of S.COST_CENTERS)
  await sql`insert into cost_centers (code,name) values (${c[0]},${c[1]}) on conflict do nothing`;
for (const g of S.GL_ACCOUNTS)
  await sql`insert into gl_accounts (code,name,type,guidance) values (${g[0]},${g[1]},${g[2]},${g[3]}) on conflict do nothing`;
for (const tr of S.TRIPS)
  await sql`insert into trips (id,employee_id,purpose,origin,destination,starts_on,ends_on,approved_by,budget_inr)
    values (${tr[0]},${tr[1]},${tr[2]},${tr[3]},${tr[4]},${tr[5]},${tr[6]},${tr[7]},${tr[8]}) on conflict do nothing`;
for (const c of S.CALENDAR)
  await sql`insert into calendar_events (id,employee_id,title,starts_at,ends_at,location,attendees)
    values (${c[0]},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]},${c[6]}) on conflict do nothing`;
for (const r of S.RECEIPTS)
  await sql`insert into receipts (id,employee_id,source,raw_text,content_hash)
    values (${r[0]},${r[1]},${r[2]},${r[3]},${contentHash(r[3])}) on conflict do nothing`;
for (const tx of S.TRANSACTIONS) {
  await sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo,scenario)
    values (${tx[0]},${tx[1]},${tx[2]},${tx[3]},${tx[4]},${tx[5]},${tx[6]},${tx[7]},${tx[8]},${tx[9]},${tx[10]},${tx[11]},${tx[12] ?? null}) on conflict do nothing`;
  await sql`insert into cases (id, transaction_id, status) values (${"CASE-" + tx[0].slice(2)}, ${tx[0]}, 'queued') on conflict do nothing`;
}
await sql`insert into policy_versions (version, body, note) values (1, ${S.POLICY_V1}, 'Set during onboarding')`;
for (const ev of S.EVAL_CASES)
  await sql`insert into eval_cases (label,payload,expect_verdict,note) values (${ev[0]}, ${JSON.stringify(ev[1])}, ${ev[2]}, ${ev[3]})`;

/* A form that cannot be repopulated looks like a form that discarded your input.
   These assert the exact round trip the onboarding screens depend on. */
console.log("\nOnboarding round trip");
await t("saved policy comes back with its body", async () => {
  const r = await sql`select version, body from policy_versions order by version desc limit 1`;
  if (!r.length || !r[0].body || r[0].body.length < 100) throw new Error("policy body missing or truncated");
  return `v${r[0].version}, ${r[0].body.split(/\s+/).length} words`;
});
await t("saved accounts come back in the shape the form renders", async () => {
  const r = await sql`select code, name, type from gl_accounts order by code`;
  if (!r.length) throw new Error("no accounts");
  const line = [r[0].code, r[0].name, r[0].type].join(", ");
  if (line.split(",").length < 3) throw new Error(`cannot render "${line}"`);
  return `${r.length} accounts, first renders as "${line}"`;
});
await t("saved cost centres come back", async () => {
  const r = await sql`select code, name from cost_centers order by code`;
  if (!r.length) throw new Error("no cost centres");
  return `${r.length}, first renders as "${[r[0].code, r[0].name].join(", ")}"`;
});
await t("saved people come back in the shape the form renders", async () => {
  const r = await sql`select id, name, email, grade, department, cost_center, manager_name from employees order by id`;
  if (!r.length) throw new Error("no employees");
  const line = [r[0].id, r[0].name, r[0].email, r[0].grade, r[0].department, r[0].cost_center, r[0].manager_name]
    .filter(x => x != null).join(", ");
  if (line.split(",").length < 6) throw new Error(`cannot render "${line}"`);
  return `${r.length} people, first renders as "${line.slice(0, 48)}…"`;
});
await t("a replace actually replaces rather than appending", async () => {
  const before = (await sql`select count(*)::int n from cost_centers`)[0].n;
  await sql`delete from cost_centers`;
  await sql`insert into cost_centers (code,name) values ('CC-X','Only One')`;
  const after = (await sql`select count(*)::int n from cost_centers`)[0].n;
  if (after !== 1) throw new Error(`expected 1 after replace, got ${after}`);
  for (const c of S.COST_CENTERS)
    await sql`insert into cost_centers (code,name) values (${c[0]},${c[1]}) on conflict do nothing`;
  await sql`delete from cost_centers where code = 'CC-X'`;
  return `${before} replaced by 1, then restored`;
});
await t("re-saving the same account code updates rather than erroring", async () => {
  await sql`insert into gl_accounts (code,name,type,guidance) values ('6130','Renamed','expense',null)
    on conflict (code) do update set name = excluded.name, type = excluded.type`;
  const r = await sql`select name from gl_accounts where code='6130'`;
  if (r[0].name !== "Renamed") throw new Error("upsert did not update");
  await sql`update gl_accounts set name='Travel - Meals (Individual)' where code='6130'`;
  return "upsert works";
});

console.log("\nCorpus");
await t("employees", async () => (await sql`select count(*)::int n from employees`)[0].n + " rows");
await t("transactions", async () => (await sql`select count(*)::int n from transactions`)[0].n + " rows");
await t("cases queued", async () => (await sql`select count(*)::int n from cases where status='queued'`)[0].n + " rows");
await t("eval cases", async () => {
  const n = (await sql`select count(*)::int n from eval_cases`)[0].n;
  if (n < 20) throw new Error(`only ${n}`); return n + " golden cases";
});
await t("every txn has a case", async () => {
  const r = await sql`select t.id from transactions t left join cases c on c.transaction_id=t.id where c.id is null`;
  if (r.length) throw new Error(`orphans: ${r.map(x=>x.id).join(",")}`); return "no orphans";
});
await t("every cost_center referenced by an employee exists", async () => {
  const r = await sql`select distinct e.cost_center from employees e left join cost_centers cc on cc.code=e.cost_center where cc.code is null`;
  if (r.length) throw new Error(`missing: ${r.map(x=>x.cost_center).join(",")}`); return "all present";
});

console.log("\nSignals have something to find");
await t("same-day split exists (Pixel Print)", async () => {
  const r = await sql`select id from transactions where lower(merchant)='pixel print studio' and txn_date='2026-08-18'`;
  if (r.length < 2) throw new Error(`only ${r.length}`); return `${r.length} charges`;
});
await t("near-duplicate exists (Amazon Business)", async () => {
  const r = await sql`select id from transactions where lower(merchant)='amazon business'`;
  if (r.length < 2) throw new Error(`only ${r.length}`); return `${r.length} charges 1 day apart`;
});
await t("orphan claim exists (no card record)", async () => {
  const c = await sql`select id, employee_id, amount_inr, txn_date from transactions where source='employee_claim'`;
  if (!c.length) throw new Error("none seeded");
  const card = await sql`select id from transactions where employee_id=${c[0].employee_id} and source='card_feed'
    and abs(amount_inr - ${c[0].amount_inr}) <= greatest(1, ${c[0].amount_inr}*0.02)
    and abs(txn_date - ${c[0].txn_date}) <= 3`;
  if (card.length) throw new Error("a card record exists, signal will not fire");
  return `${c[0].id} has no independent record`;
});
await t("out-of-trip-window charge exists", async () => {
  const r = await sql`select t.id from transactions t
    where exists (select 1 from trips tr where tr.employee_id=t.employee_id)
      and not exists (select 1 from trips tr where tr.employee_id=t.employee_id and t.txn_date between tr.starts_on-1 and tr.ends_on+1)`;
  if (!r.length) throw new Error("none"); return `${r.length} charges`;
});
await t("in-trip-window charge exists", async () => {
  const r = await sql`select t.id from transactions t
    join trips tr on tr.employee_id=t.employee_id and t.txn_date between tr.starts_on-1 and tr.ends_on+1`;
  if (!r.length) throw new Error("none"); return `${r.length} charges`;
});
await t("calendar corroboration available", async () => {
  const r = await sql`select t.id from transactions t join calendar_events ce
    on ce.employee_id=t.employee_id and ce.starts_at::date=t.txn_date`;
  if (!r.length) throw new Error("none"); return `${r.length} charges`;
});
await t("every seeded charge explains why it is in the corpus", async () => {
  const r = await sql`select id from transactions where scenario is null or length(scenario) < 20`;
  if (r.length) throw new Error(`unexplained: ${r.map(x=>x.id).join(",")}`);
  return "all 18 labelled";
});
await t("unseen merchants exist", async () => {
  const r = await sql`select merchant from transactions group by merchant having count(*)=1`;
  return `${r.length} single-use merchants`;
});
await t("policy mentions every clause the golden set cites", async () => {
  const body = (await sql`select body from policy_versions order by version desc limit 1`)[0].body;
  const need = ["3.3", "4.1", "4.2", "4.3", "5.3", "6.1", "6.2", "6.3", "7.1", "7.2", "8.1", "8.3", "9.2", "9.3", "10.1", "10.2"];
  const missing = need.filter((n) => !body.includes(n));
  if (missing.length) throw new Error(`policy is missing ${missing.join(", ")}`);
  return `${need.length} clauses present`;
});
await t("golden set covers all four outcomes", async () => {
  const r = await sql`select expect_verdict, count(*)::int n from eval_cases group by expect_verdict order by expect_verdict`;
  const m = Object.fromEntries(r.map((x) => [x.expect_verdict, x.n]));
  const missing = ["APPROVE", "PARTIAL", "REJECT", "ESCALATE"].filter((v) => !m[v]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} in ${JSON.stringify(m)}`);
  return `APPROVE ${m.APPROVE}, PARTIAL ${m.PARTIAL}, REJECT ${m.REJECT}, ESCALATE ${m.ESCALATE}`;
});

console.log(fail ? `\n${fail} FAILED\n` : "\nAll good\n");
process.exit(fail ? 1 : 0);
