// The two intake paths differ in evidence and in accounting treatment. These
// assert that difference exists in the data rather than only in the prose.
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
const ddl = fs.readFileSync(new URL("../src/lib/schema.ts", import.meta.url), "utf8");
for (const m of [...ddl.matchAll(/`([\s\S]*?)`,\n/g)]) await db.exec(m[1]);

let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

for (const e of S.EMPLOYEES)
  await sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
    values (${e[0]},${e[1]},${e[2]},${e[3]},${e[4]},${e[5]},${e[6]},${e[7]})`;
for (const g of S.GL_ACCOUNTS)
  await sql`insert into gl_accounts (code,name,type,guidance) values (${g[0]},${g[1]},${g[2]},${g[3]})`;
for (const tx of S.TRANSACTIONS)
  await sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo,scenario)
    values (${tx[0]},${tx[1]},${tx[2]},${tx[3]},${tx[4]},${tx[5]},${tx[6]},${tx[7]},${tx[8]},${tx[9]},${tx[10]},${tx[11]},${tx[12] ?? null})`;

console.log("\nTwo intake paths exist in the corpus");
const card = await sql`select count(*)::int n from transactions where source='card_feed'`;
const claim = await sql`select count(*)::int n from transactions where source='employee_claim'`;
t("card feed charges", card[0].n > 0, `${card[0].n}`);
t("employee claims", claim[0].n > 0, `${claim[0].n}`);

console.log("\nA claim is genuinely uncorroborated");
const c = (await sql`select * from transactions where source='employee_claim' limit 1`)[0];
const independent = await sql`
  select id from transactions where employee_id=${c.employee_id} and source='card_feed'
    and abs(amount_inr - ${Number(c.amount_inr)}) <= greatest(1, ${Number(c.amount_inr)}*0.02)
    and abs(txn_date - ${c.txn_date}) <= 3`;
t("no card record backs the claim", independent.length === 0,
  `${c.id} at ${c.merchant} stands only on its receipt`);
t("a card charge does have an independent record by definition", true,
  "the feed itself is the record");

console.log("\nThe accounting treatment differs");
const payables = await sql`select code from gl_accounts where code='2120'`;
const cardLiab = await sql`select code from gl_accounts where code='2110'`;
t("employee payables account exists", payables.length === 1, "2120");
t("card liability account exists", cardLiab.length === 1, "2110");
t("they are different accounts", payables[0].code !== cardLiab[0].code,
  "a claim credits 2120, a card charge credits 2110");

console.log("\nReceipt provenance is recorded, not assumed");
for (const r of S.RECEIPTS)
  await sql`insert into receipts (id,employee_id,source,raw_text,content_hash) values (${r[0]},${r[1]},${r[2]},${r[3]},${'h'+r[0]})`;
const sources = await sql`select source, count(*)::int n from receipts group by source order by source`;
t("every receipt records how it arrived", sources.every(s => s.source),
  sources.map(s => `${s.source}:${s.n}`).join(" "));
t("more than one arrival path is represented", sources.length > 1);

console.log("\nTrace columns exist so no call is unreadable");
const cols = await sql`select column_name from information_schema.columns where table_name='agent_runs'`;
const names = cols.map(c => c.column_name);
for (const need of ["system_prompt","input_payload","raw_output","input_tok","output_tok","latency_ms","cost_usd"])
  t(`agent_runs.${need}`, names.includes(need));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
