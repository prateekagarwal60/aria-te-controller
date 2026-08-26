// Runs the real DDL and every query shape the app uses against an in-process Postgres.
// Catches SQL errors that would otherwise only show up in front of the panel.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fail = 0, pass = 0;

// Mimic the neon tagged-template client.
function makeSql(db) {
  const fn = async (strings, ...vals) => {
    if (typeof strings === "string") { await db.exec(strings); return []; }
    let text = "";
    let i = 0;
    for (const s of strings) { text += s; if (i < vals.length) text += `$${++i}`; }
    const r = await db.query(text, vals);
    return r.rows;
  };
  return fn;
}
const sql = makeSql(db);

async function check(name, fn) {
  try { await fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}

// ---- DDL ----
const ddlSrc = fs.readFileSync(new URL("../src/lib/schema.ts", import.meta.url), "utf8");
const DDL = [...ddlSrc.matchAll(/`([\s\S]*?)`,\n/g)].map((m) => m[1]);
console.log(`\nSchema: ${DDL.length} statements`);
for (const stmt of DDL) {
  await check(stmt.split("\n")[0].slice(0, 62), () => db.exec(stmt));
}

// ---- Seed a minimal but representative corpus ----
console.log("\nSeed");
await check("insert employee", () => sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
  values ('E-1','A Rao','a@x.com','M4','Sales','CC-SAL','V Shah','2021-06-14')`);
await check("insert cost center", () => sql`insert into cost_centers (code,name) values ('CC-SAL','Sales')`);
await check("insert gl account", () => sql`insert into gl_accounts (code,name,type,guidance) values ('6130','Meals','expense','g')`);
await check("insert gl account 2", () => sql`insert into gl_accounts (code,name,type,guidance) values ('2110','Card Liability','liability','g')`);
await check("insert trip", () => sql`insert into trips (id,employee_id,purpose,origin,destination,starts_on,ends_on,approved_by,budget_inr)
  values ('T-1','E-1','QBR','BLR','BOM','2026-08-03','2026-08-06','V Shah',95000)`);
await check("insert calendar", () => sql`insert into calendar_events (id,employee_id,title,starts_at,ends_at,location,attendees)
  values ('C-1','E-1','QBR','2026-08-04T10:00:00Z','2026-08-04T13:00:00Z','Mumbai',7)`);
await check("insert receipt", () => sql`insert into receipts (id,employee_id,source,raw_text,content_hash)
  values ('R-1','E-1','email','THE TABLE ... TOTAL 10085.50','abc123')`);
await check("insert receipt dupe hash", () => sql`insert into receipts (id,employee_id,source,raw_text,content_hash)
  values ('R-2','E-1','upload','THE TABLE ... TOTAL 10085.50','abc123')`);
await check("insert txn", () => sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo)
  values ('X-1','E-1','The Table','5812',10085.50,'INR',10085.50,'2026-08-04','22:58','4417','card_feed',null)`);
await check("insert txn near-dupe", () => sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo)
  values ('X-2','E-1','The Table','5812',10085.50,'INR',10085.50,'2026-08-05','21:10','4417','card_feed',null)`);
await check("insert claim txn", () => sql`insert into transactions (id,employee_id,merchant,amount,currency,amount_inr,txn_date,source)
  values ('X-3','E-1','Grand Banquets',18000,'INR',18000,'2026-08-13','employee_claim')`);
await check("insert case", () => sql`insert into cases (id,transaction_id,status) values ('CASE-1','X-1','queued')`);
await check("insert case 3", () => sql`insert into cases (id,transaction_id,status) values ('CASE-3','X-3','queued')`);
await check("insert policy", () => sql`insert into policy_versions (version, body, note) values (1,'# Policy','seed')`);
await check("insert authority", () => sql`insert into authority (id) values (1)`);
await check("insert eval case", () => sql`insert into eval_cases (label,payload,expect_verdict,note)
  values ('t', ${JSON.stringify({ merchant: "X" })}, 'APPROVE','n')`);

// ---- signals.ts queries ----
console.log("\nCorroboration signals");
const txn = { id: "X-1", employee_id: "E-1", merchant: "The Table", amount: 10085.5, amount_inr: 10085.5, txn_date: "2026-08-04", currency: "INR", source: "card_feed" };
const amt = txn.amount_inr;
await check("near-duplicate", async () => {
  const r = await sql`select id, txn_date, amount_inr from transactions
    where employee_id = ${txn.employee_id} and lower(merchant) = lower(${txn.merchant})
      and id <> ${txn.id} and abs(amount_inr - ${amt}) <= greatest(1, ${amt} * 0.02)
      and abs(txn_date - ${txn.txn_date}::date) <= 4`;
  if (r.length !== 1) throw new Error(`expected 1 near-duplicate, got ${r.length}`);
});
await check("same-day split", () => sql`select id, amount_inr from transactions
  where employee_id = ${txn.employee_id} and lower(merchant) = lower(${txn.merchant})
    and txn_date = ${txn.txn_date}::date and id <> ${txn.id}`);
await check("unseen merchant", () => sql`select count(*)::int as n from transactions
  where lower(merchant) = lower(${txn.merchant}) and id <> ${txn.id}`);
await check("trip window", async () => {
  const r = await sql`select id, destination, starts_on, ends_on, purpose, budget_inr from trips
    where employee_id = ${txn.employee_id} and ${txn.txn_date}::date between starts_on - 1 and ends_on + 1`;
  if (r.length !== 1) throw new Error(`expected 1 trip, got ${r.length}`);
});
await check("any trip count", () => sql`select count(*)::int as n from trips where employee_id = ${txn.employee_id}`);
await check("calendar match", async () => {
  const r = await sql`select id, title, starts_at, location, attendees from calendar_events
    where employee_id = ${txn.employee_id} and starts_at::date = ${txn.txn_date}::date`;
  if (r.length !== 1) throw new Error(`expected 1 event, got ${r.length}`);
});
await check("receipt reuse by hash", async () => {
  const r = await sql`select id, employee_id from receipts where content_hash = ${"abc123"} and id <> ${"R-1"}`;
  if (r.length !== 1) throw new Error(`expected 1 reuse, got ${r.length}`);
});
await check("orphan claim check", () => sql`select id from transactions
  where employee_id = ${"E-1"} and source = 'card_feed'
    and abs(amount_inr - ${18000}) <= greatest(1, ${18000} * 0.02)
    and abs(txn_date - ${"2026-08-13"}::date) <= 3`);
await check("velocity", () => sql`select count(*)::int as n from transactions
  where employee_id = ${txn.employee_id} and lower(merchant) = lower(${txn.merchant})
    and txn_date between ${txn.txn_date}::date - 30 and ${txn.txn_date}::date`);

// ---- agents/index.ts queries ----
console.log("\nAgent queries");
await check("gather: employee", () => sql`select * from employees where id = ${"E-1"}`);
/* Windows are passed as parameters by the real code, not written as literals.
   A bare parameter next to a date resolves as date minus date, which yields an
   integer and breaks the comparison, so these must be checked in the exact shape
   the application sends. Writing literals here is how that bug reached the user. */
const W = { receipts: 14, calendar: 2, trips: 3 };
await check("gather: receipts window, parameterised", () => sql`
  select id, source, raw_text, extracted, content_hash, created_at from receipts
  where employee_id = ${"E-1"}
    and abs(created_at::date - ${"2026-08-04"}::date) <= ${W.receipts}::int
  order by created_at desc limit 12`);
await check("gather: calendar window, parameterised", () => sql`
  select id, title, starts_at, location, attendees from calendar_events
  where employee_id = ${"E-1"}
    and starts_at::date between ${"2026-08-04"}::date - ${W.calendar}::int
                            and ${"2026-08-04"}::date + ${W.calendar}::int`);
await check("gather: trips window, parameterised", () => sql`
  select * from trips where employee_id = ${"E-1"}
    and ${"2026-08-04"}::date between starts_on - ${W.trips}::int and ends_on + ${W.trips}::int`);
await check("gather: merchant history", () => sql`
  select id, txn_date, amount_inr, source from transactions
  where employee_id = ${"E-1"} and lower(merchant) = lower(${"The Table"})
    and id <> ${"X-1"} order by txn_date desc limit 8`);

/* The failure mode itself, asserted directly: the uncast form must be rejected,
   so that if someone drops a cast later this test tells them why. */
await check("an uncast day window is rejected, which is why the casts are there", async () => {
  let threw = null;
  try {
    await sql`select * from trips where employee_id = ${"E-1"}
      and ${"2026-08-04"}::date between starts_on - ${3} and ends_on + ${3}`;
  } catch (e) { threw = e.message; }
  if (!threw) throw new Error("expected the uncast form to fail, but it succeeded");
  if (!/operator does not exist/i.test(threw)) throw new Error(`failed for a different reason: ${threw}`);
});
await check("decide: latest policy", () => sql`select * from policy_versions order by version desc limit 1`);
await check("decide: precedents", () => sql`select p.merchant, p.category, p.amount_band, p.situation, p.decision, p.rationale, p.created_at
  from precedents p where lower(coalesce(p.merchant,'')) = lower(${"The Table"}) or lower(coalesce(p.category,'')) = lower(${"meals"})
  order by p.created_at desc limit 6`);
await check("authority read", () => sql`select * from authority where id = 1`);
await check("post: accounts", () => sql`select code, name, type, guidance from gl_accounts order by code`);
await check("post: cost centres", () => sql`select code, name from cost_centers order by code`);

// ---- write paths ----
console.log("\nWrite paths");
await check("agent_runs insert", () => sql`insert into agent_runs (case_id, agent, model, input_tok, output_tok, latency_ms, cost_usd, ok, error)
  values (${"CASE-1"}, ${"decide"}, ${"claude"}, ${100}, ${50}, ${800}, ${0.0012}, ${true}, ${null})`);
await check("cases update assembled", () => sql`update cases set assembled=${JSON.stringify({ narrative: "x", evidence: [] })} where id=${"CASE-1"}`);
await check("cases update investigation", () => sql`update cases set investigation=${JSON.stringify({ risk_band: "LOW" })}, risk_band=${"LOW"}, risk_score=${12} where id=${"CASE-1"}`);
await check("cases update adjudication", () => sql`update cases set adjudication=${JSON.stringify({ verdict: "APPROVE" })}, verdict=${"APPROVE"},
  confidence=${0.91}, amount_allowed=${10085.5}, policy_version=${1} where id=${"CASE-1"}`);
await check("cases update authority", () => sql`update cases set authority=${JSON.stringify({ acted: true })} where id=${"CASE-1"}`);
await check("escalation insert", () => sql`insert into escalations (case_id, reason, question, recommendation)
  values (${"CASE-3"}, ${"over limit"}, ${"confirm?"}, ${"allow"})`);
await check("escalation open lookup", () => sql`select id from escalations where case_id=${"CASE-3"} and status='open'`);
await check("escalation resolve", () => sql`update escalations set status='resolved', human_decision=${"APPROVE"},
  human_rationale=${"client meal"}, resolved_by=${"Controller"}, resolved_at=now() where id=${1}`);
await check("precedent insert", () => sql`insert into precedents (escalation_id, merchant, category, amount_band, situation, decision, rationale)
  values (${1}, ${null}, ${"client meals"}, ${"any amount"}, ${"when attendees are named"}, ${"APPROVE"}, ${"fine"}) returning *`);
await check("journal entry insert", async () => {
  const e = await sql`insert into journal_entries (case_id, entry_ref) values (${"CASE-1"}, ${"JE-001"}) returning id, entry_ref`;
  await sql`insert into journal_lines (entry_id, account_code, cost_center, debit, credit, memo)
    values (${e[0].id}, ${"6130"}, ${"CC-SAL"}, ${10085.5}, ${0}, ${"client dinner"})`;
  await sql`insert into journal_lines (entry_id, account_code, cost_center, debit, credit, memo)
    values (${e[0].id}, ${"2110"}, ${"CC-SAL"}, ${0}, ${10085.5}, ${"card"})`;
});
await check("policy new version", async () => {
  const c = await sql`select coalesce(max(version),0) as v from policy_versions`;
  await sql`insert into policy_versions (version, body, note) values (${Number(c[0].v) + 1}, ${"# v2"}, ${"edit"})`;
});
await check("authority update", () => sql`update authority set auto_approve_limit=${50000}, auto_reject_limit=${5000},
  min_confidence=${0.85}, escalate_risk_at=${"HIGH"}, can_post_ledger=${true}, can_reject=${true}, updated_at=now() where id=1`);
await check("eval run insert", async () => {
  const r = await sql`insert into eval_runs (policy_version, total, correct, escalations, avg_latency_ms, total_cost_usd, detail)
    values (${1}, ${24}, ${0}, ${0}, ${0}, ${0}, ${JSON.stringify([{ id: 1 }])}) returning id`;
  await sql`update eval_runs set detail = ${JSON.stringify([{ id: 1 }, { id: 2 }])} where id = ${r[0].id}`;
  await sql`update eval_runs set correct=${20}, escalations=${4}, avg_latency_ms=${900}, total_cost_usd=${0.03} where id=${r[0].id}`;
});
await check("eval cases paged", () => sql`select * from eval_cases order by id offset ${0} limit ${5}`);

// ---- read paths used by /api/state and /api/ledger ----
console.log("\nConsole reads");
await check("state: cases join", async () => {
  const r = await sql`select c.*, t.merchant, t.amount, t.currency, t.amount_inr, t.txn_date, t.txn_time,
      t.card_last4, t.source, t.memo, t.mcc, e.name as employee_name, e.grade, e.department, e.cost_center
    from cases c join transactions t on t.id = c.transaction_id join employees e on e.id = t.employee_id
    order by t.txn_date desc, c.id`;
  if (r.length !== 2) throw new Error(`expected 2 cases, got ${r.length}`);
});
await check("state: escalations join", () => sql`select es.*, c.transaction_id, t.merchant, t.amount_inr, t.txn_date, e.name as employee_name
  from escalations es join cases c on c.id = es.case_id join transactions t on t.id = c.transaction_id
  join employees e on e.id = t.employee_id order by es.status asc, es.created_at desc`);
await check("state: policy history", () => sql`select version, note, created_at from policy_versions order by version desc limit 20`);
await check("state: precedents", () => sql`select * from precedents order by created_at desc limit 30`);
await check("state: receipts", () => sql`select id, employee_id, source, raw_text, content_hash, created_at from receipts order by created_at desc limit 60`);
await check("state: meter by agent", () => sql`select agent, count(*)::int as n, avg(latency_ms)::int as avg_ms, sum(cost_usd) as cost
  from agent_runs group by agent order by agent`);
await check("state: meter totals", () => sql`select coalesce(sum(cost_usd),0) as cost, coalesce(avg(latency_ms),0)::int as avg_ms, count(*)::int as calls from agent_runs`);
await check("ledger: entries", () => sql`select je.id, je.entry_ref, je.posted_at, je.case_id, t.merchant, e.name as employee_name
  from journal_entries je join cases c on c.id = je.case_id join transactions t on t.id = c.transaction_id
  join employees e on e.id = t.employee_id order by je.posted_at desc`);
await check("ledger: lines", () => sql`select jl.*, ga.name as account_name, ga.type as account_type
  from journal_lines jl left join gl_accounts ga on ga.code = jl.account_code order by jl.entry_id, jl.id`);
await check("ledger: trial balance balances", async () => {
  const r = await sql`select coalesce(sum(debit),0) as debit, coalesce(sum(credit),0) as credit from journal_lines`;
  if (Number(r[0].debit) !== Number(r[0].credit)) throw new Error(`unbalanced: ${r[0].debit} vs ${r[0].credit}`);
});
await check("step: case+txn join", async () => {
  const r = await sql`select c.*, t.* , c.id as case_id, c.status as case_status
    from cases c join transactions t on t.id = c.transaction_id where c.id = ${"CASE-1"}`;
  if (!r.length) throw new Error("no row");
  if (r[0].case_id !== "CASE-1") throw new Error("case_id alias collided with transaction id");
});
await check("reset: requeue", () => sql`update cases set status='queued', verdict=null, confidence=null, risk_band=null, risk_score=null,
  amount_allowed=null, assembled=null, investigation=null, adjudication=null, closing=null, authority=null, closed_at=null`);
await check("reset: truncate ledger", () => sql`truncate journal_lines, journal_entries restart identity cascade`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
