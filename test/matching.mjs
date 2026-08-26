// Receipt matching filtered on when a row arrived in the database rather than on
// the date printed on the document. Five of ten seeded receipts fell outside the
// window purely because the corpus had been seeded a few days earlier, and in
// production a receipt uploaded three weeks after a trip would never match.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

execSync("npx esbuild src/lib/seed.ts --bundle --format=cjs --platform=node --outfile=/tmp/sd.cjs", { stdio: "ignore" });
const S = createRequire(import.meta.url)("/tmp/sd.cjs");

console.log("\nThe date is read from the document");
t("an ISO date", S.spendDateFrom("Invoice 2026-08-06 total 30,444") === "2026-08-06");
t("a written date", S.spendDateFrom("Check-out 06 Aug 2026") === "2026-08-06");
t("a single digit day is padded", S.spendDateFrom("2 Aug 2026") === "2026-08-02");
t("a full month name", S.spendDateFrom("14 August 2026") === "2026-08-14");
t("nothing when there is no date", S.spendDateFrom("TOTAL 1,240.00") === null);
t("nothing from empty text", S.spendDateFrom("") === null);

console.log("\nEvery seeded receipt carries one");
let missing = 0;
for (const r of S.RECEIPTS) if (!S.spendDateFrom(r[3])) { missing++; console.log(`  FAIL ${r[0]} has no readable date`); }
t("all ten", missing === 0, `${S.RECEIPTS.length} receipts`);

console.log("\nAnd it is the date of the spend, not of the upload");
for (const [rid, xid] of Object.entries(S.RECEIPT_LINKS)) {
  const txn = S.TRANSACTIONS.find((x) => x[0] === xid);
  const rec = S.RECEIPTS.find((x) => x[0] === rid);
  if (!txn || !rec) continue;
  const d = S.spendDateFrom(rec[3]);
  const gap = Math.abs((new Date(d) - new Date(txn[7])) / 86400000);
  t(`${rid} sits within the window of ${xid}`, gap <= 14, `${d} vs charge ${txn[7]}, ${gap} days`);
}

console.log("\nThe query filters on the right column");
const agents = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("coalesce spend_date, then arrival", /abs\(coalesce\(spend_date, created_at::date\)/.test(agents));
t("and orders by it too", /order by coalesce\(spend_date, created_at::date\) desc/.test(agents));
t("it is selected", /select id, source, raw_text, extracted, content_hash, created_at, spend_date/.test(agents));

console.log("\nAnd it is populated wherever a receipt is written");
t("the seeded corpus", /spend_date\)\s*\n?\s*values[\s\S]{0,220}spendDateFrom\(r\[3\]\)/.test(fs.readFileSync("src/app/api/onboard/route.ts", "utf8")));
const rec = fs.readFileSync("src/app/api/receipts/route.ts", "utf8");
t("an upload, from what the extractor found", /const found = json\?\.date/.test(rec));
t("falling back to the text", /: spendDateFrom\(text\)/.test(rec));
t("and it reaches the insert", /\$\{hash\}, \$\{spend\}\)/.test(rec));

console.log("\nThe window now behaves the same however old the database is");
const db = new PGlite();
const DDL = [...fs.readFileSync("src/lib/schema.ts", "utf8").matchAll(/`([\s\S]*?)`,\n/g)].map((m) => m[1]);
for (const d of DDL) await db.exec(d);
await db.exec(`insert into employees (id,name,email,grade,department,cost_center)
  values ('E-1','A Rao','a@x.com','M4','Sales','CC-SAL')`);
// A receipt for a charge on 6 August, inserted today, which is what a seeded
// corpus or a late upload looks like.
await db.exec(`insert into receipts (id,employee_id,source,raw_text,content_hash,spend_date)
  values ('R-1','E-1','email','TAJ 06 Aug 2026','h1','2026-08-06')`);
await db.exec(`insert into receipts (id,employee_id,source,raw_text,content_hash)
  values ('R-2','E-1','email','No date on this one','h2')`);

const found = async (txnDate) => (await db.query(
  `select id from receipts where employee_id = 'E-1'
     and abs(coalesce(spend_date, created_at::date) - $1::date) <= 14`, [txnDate])).rows.map((r) => r.id);

t("the dated receipt matches its own charge", (await found("2026-08-06")).includes("R-1"),
  "it would not have, filtering on when the row arrived");
t("and does not match a charge three months away", !(await found("2026-11-20")).includes("R-1"));
t("an undated receipt still falls back to arrival", (await found(new Date().toISOString().slice(0, 10))).includes("R-2"));

console.log("\nA receipt written before the column existed is filled in");
/* Adding the column changed nothing on its own: every existing row had it null,
   so the window fell back to arrival time and behaved exactly as before. */
/* One routine, shared by the web route and the evaluation runner. They each
   applied the schema separately before this and had already drifted: only one of
   them filled in a column the other had just added. */
const mig = fs.readFileSync("src/lib/migrate.ts", "utf8");
t("the migration looks for undated receipts", /spend_date is null and raw_text is not null/.test(mig));
t("reads the date off the text", /spendDateFrom\(r\.raw_text\)/.test(mig));
t("and writes it back", /update receipts set spend_date = \$\{d\} where id = \$\{r\.id\}/.test(mig));
t("a receipt with no readable date is left alone", /if \(!d\) continue;/.test(mig));
t("a database mid-upgrade does not crash on it", /The column may not exist/.test(mig));
t("the application calls it", /migrate\(sql, \(m\) => console\.log/.test(
  fs.readFileSync("src/app/api/bootstrap/route.ts", "utf8")));
t("and so does the evaluation runner", /MIGRATE\.migrate\(sql/.test(
  fs.readFileSync("test/eval/run.mjs", "utf8")),
  "so running an eval prepares the database the same way the app does");
t("the schema version was bumped so it actually runs",
  /SCHEMA_VERSION = 16/.test(fs.readFileSync("src/lib/schema.ts", "utf8")),
  "without this the console never asks for a bootstrap again");

// The backfill, run for real.
await db.exec(`insert into receipts (id,employee_id,source,raw_text,content_hash)
  values ('R-3','E-1','email','TAJ LANDS END 06 Aug 2026 TOTAL 30444','h3')`);
await db.exec(`insert into receipts (id,employee_id,source,raw_text,content_hash)
  values ('R-4','E-1','email','NO DATE ANYWHERE total 900','h4')`);
const undated = (await db.query("select id, raw_text from receipts where spend_date is null and raw_text is not null")).rows;
for (const r of undated) {
  const d = S.spendDateFrom(r.raw_text);
  if (!d) continue;
  await db.query("update receipts set spend_date = $1 where id = $2", [d, r.id]);
}
const r3 = (await db.query("select spend_date from receipts where id='R-3'")).rows[0];
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
t("the dated one was filled in", iso(r3.spend_date) === "2026-08-06", iso(r3.spend_date));
const r4 = (await db.query("select spend_date from receipts where id='R-4'")).rows[0];
t("the undated one was left null", r4.spend_date === null, "so it still falls back to arrival");
t("and now it matches its own charge", (await found("2026-08-06")).includes("R-3"),
  "which is the whole point of the column");

console.log("\nA percentile is only gated when the sample can resolve it");
const run = fs.readFileSync("test/eval/run.mjs", "utf8");
t("there is a sample-size check", /const enoughFor = \(q\) =>/.test(run));
t("p95 is only added to the gates when it passes", /enoughFor\(0\.95\)/.test(run));
t("and is reported plainly when it is not", /cannot resolve a 95th percentile/.test(run));
const enough = (n) => n >= Math.ceil(1 / (1 - 0.95)) * 4;
t("twenty calls is not enough", !enough(20), "the 95th percentile there is one call");
t("eighty is", enough(80));

console.log("\nA proposed match whose totals are nothing alike is refused");
/* A INR 477 cab charge was matched to a INR 25,536 hotel folio. Which receipt is
   the right one is judgment. Whether two totals are the same order of magnitude
   is arithmetic, so it does not stay with the model. */
const ag2 = fs.readFileSync("src/lib/agents/index.ts", "utf8");
t("there is a total to compare against", /function receiptTotal/.test(ag2));
t("read from the extraction first", /r\?\.extracted\?\.total/.test(ag2));
t("and from the text when there is none", /total\\s\*\(\[A-Z\]\{3\}\)\?/.test(ag2));
/* A first version compared a Singapore Airlines total of SGD 700.40 against a
   charge of INR 45,526 and called it a mismatch. There is no rate table here, so
   a total in another currency is simply not comparable. */
t("a total in another currency is not comparable", /m\[1\]\.toUpperCase\(\) !== String\(currency\)/.test(ag2));
t("and the same applies to the extraction", /String\(extractCcy\)\.toUpperCase\(\) !== String\(currency\)/.test(ag2));
t("the charge is compared in its own currency", /const charged = money\(txn\.amount\);/.test(ag2),
  "not the INR conversion, which is what caused the false mismatch");
t("the match is refused when they differ by a multiple", /ratio >= 0\.6 && ratio <= 1\.6/.test(ag2));
t("and the refusal is recorded", /match_amount_mismatch/.test(ag2));
t("a receipt with no readable total is still allowed through",
  /if \(onReceipt === null\) return proposed/.test(ag2), "absence is not evidence of a bad match");

const keep = (charged, onReceipt) => {
  if (onReceipt === null) return true;
  if (charged <= 0) return true;
  const r = onReceipt / charged;
  return r >= 0.6 && r <= 1.6;
};
t("the cab and the hotel folio are refused", !keep(477, 25536), "53 times out");
t("an exact match is kept", keep(25536, 25536));
t("a tip added after authorisation is kept", keep(5000, 5750), "15% more");
t("a partial capture is kept", keep(9400, 9000));
t("a currency rounding difference is kept", keep(45526, 45500));
t("twice the amount is refused", !keep(5000, 10000));
t("a tenth of the amount is refused", !keep(9400, 940));
t("no total on the receipt is not a reason to refuse", keep(477, null));

console.log("\nNo correct pair in the corpus is refused by the guard");
const totalOf = (text, ccy) => {
  const m = String(text).match(/total\s*([A-Z]{3})?[^0-9A-Za-z]{0,8}([0-9][0-9,]*\.?[0-9]{0,2})/i);
  if (!m) return null;
  if (m[1] && m[1].toUpperCase() !== String(ccy).toUpperCase()) return null;
  const n = Number(m[2].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const survives = (c, r) => r === null || c <= 0 || (r / c >= 0.6 && r / c <= 1.6);
let refused = 0;
for (const [rid, xid] of Object.entries(S.RECEIPT_LINKS)) {
  const txn = S.TRANSACTIONS.find((x) => x[0] === xid);
  const rec = S.RECEIPTS.find((x) => x[0] === rid);
  if (!txn || !rec) continue;
  const ok = survives(txn[4], totalOf(rec[3], txn[5]));
  if (!ok) refused++;
  t(`${rid} survives`, ok, `${txn[4]} ${txn[5]}`);
}
t("none of the ten is thrown away", refused === 0);
t("and the cab matched to a hotel folio is", !survives(477, totalOf(
  S.RECEIPTS.find((x) => x[0] === "R-2010")[3], "INR")), "477 against 25,536");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
