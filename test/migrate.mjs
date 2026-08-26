// Applying the schema only when a query had already failed meant a database that
// already worked never received a new column. Everything added after the first
// bootstrap silently did not exist, and it surfaced as a button that did nothing.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const src = fs.readFileSync("src/lib/schema.ts", "utf8");
const VERSION = Number(src.match(/SCHEMA_VERSION = (\d+)/)[1]);
const DDL = [...src.matchAll(/`([\s\S]*?)`,\n/g)].map((m) => m[1]);

const db = new PGlite();
const sql = async (strings, ...vals) => {
  if (typeof strings === "string") {
    if (/^\s*(create|alter|drop|truncate|update|insert)/i.test(strings)) { await db.exec(strings); return []; }
    return (await db.query(strings, vals)).rows;
  }
  let text = "", i = 0;
  for (const s of strings) { text += s; if (i < vals.length) text += `$${++i}`; }
  return (await db.query(text, vals)).rows;
};

console.log("\nA database from an older build is brought up to date");
// An older schema: no review columns, no version column.
const older = DDL.filter((d) =>
  !/reviewed_at|review_agreed|review_note|schema_version/.test(d));
for (const d of older) await db.exec(d);
await db.exec("insert into company (id, name, onboarded_at) values (1, 'Meridian', now())");
await db.exec("insert into authority (id) values (1)");
await db.exec(`insert into employees (id,name,email,grade,department,cost_center)
  values ('E-1','A Rao','a@x.com','M4','Sales','CC-SAL')`);
await db.exec(`insert into transactions (id,employee_id,merchant,amount,currency,amount_inr,txn_date,source)
  values ('X-1','E-1','Taj',9400,'INR',9400,'2026-08-04','card_feed')`);
await db.exec(`insert into cases (id,transaction_id,status,verdict) values ('CASE-1','X-1','settled','APPROVE')`);

const cols = async () => (await sql`select column_name from information_schema.columns where table_name='cases'`).map((r) => r.column_name);
t("the older database has no review columns", !(await cols()).includes("reviewed_at"));

let ver = await sql`select column_name from information_schema.columns where table_name='company' and column_name='schema_version'`;
t("and no version to compare against", ver.length === 0);

console.log("\nThe console notices and applies what is missing");
// What /api/state does.
let recorded = 0;
try {
  const c = await sql`select * from company where id = 1`;
  recorded = Number(c[0].schema_version ?? 0);
} catch { recorded = 0; }
t("it reads as behind", recorded < VERSION, `${recorded} against ${VERSION}`);

// What /api/bootstrap does.
for (const d of DDL) await db.exec(d);
await db.exec(`update company set schema_version = ${VERSION} where id = 1`);

console.log("\nAfter that the new columns exist and nothing was lost");
const after = await cols();
for (const col of ["reviewed_at", "review_agreed", "review_note"])
  t(`cases.${col}`, after.includes(col));
t("the version is recorded",
  Number((await sql`select schema_version from company where id=1`)[0].schema_version) === VERSION);
const c1 = (await sql`select * from cases where id='CASE-1'`)[0];
t("the settled charge survived", c1.status === "settled" && c1.verdict === "APPROVE");
t("and counts as unchecked rather than agreed", c1.reviewed_at === null && c1.review_agreed === null);

console.log("\nRunning it again changes nothing");
for (const d of DDL) await db.exec(d);
t("still one company row", (await sql`select count(*)::int n from company`)[0].n === 1);
t("still one charge", (await sql`select count(*)::int n from cases`)[0].n === 1);
t("version unchanged",
  Number((await sql`select schema_version from company where id=1`)[0].schema_version) === VERSION);

console.log("\nThe wiring that makes this happen");
const state = fs.readFileSync("src/app/api/state/route.ts", "utf8");
const boot = fs.readFileSync("src/app/api/bootstrap/route.ts", "utf8");
const page = fs.readFileSync("src/app/page.tsx", "utf8");
t("state compares the recorded version", /Number\(co\[0\]\.schema_version \?\? 0\) < SCHEMA_VERSION/.test(state));
t("and asks for a bootstrap when behind", /needsBootstrap: true/.test(state));
t("bootstrap records the version it applied", /update company set schema_version = \$\{SCHEMA_VERSION\}/.test(boot));
t("concurrent startups share one request", /if \(!bootstrapping\.current\)/.test(page),
  "a boolean guard here made the second report a failure the first was about to fix");
t("there is still a limit on retries", /attempts\.current >= 2/.test(page));
t("and the bootstrap reply is what gets shown",
  /if \(b && b\.ok === false\) \{[\s\S]{0,120}error: b\.error/.test(page),
  "not whatever the previous state call happened to say");

console.log("\nThe failure it was hiding");
const wp = fs.readFileSync("src/components/Workpaper.tsx", "utf8");
t("the review call reads its reply", /if \(!r\.ok\) \{ setOptimistic\(null\); setReviewError/.test(wp));
t("and an optimistic tick is taken back when it fails", /setOptimistic\(null\)/.test(wp),
  "pressing a button that then silently fails is worse than one that is slow");
t("and shows it", /\{reviewError\}/.test(wp));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
