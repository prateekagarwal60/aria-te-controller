// The eval runner failed on an empty database with a raw Postgres trace. It now
// creates whatever is missing. This runs that exact sequence against a genuinely
// empty database, and then again against a populated one to prove it never
// overwrites what is already there.
import { PGlite } from "@electric-sql/pglite";
import * as SEED from "../.evalbuild/seed.mjs";
import fs from "node:fs";
import { migrate } from "../.evalbuild/migrate.mjs";

let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

/* Mirrors the neon client: called with a plain string it runs the query and
   returns rows, called as a tagged template it parameterises. An earlier version
   of this shim threw away rows on the string path, which is not what neon does
   and would have made this test pass for the wrong reason. */
function client(db) {
  return async (strings, ...vals) => {
    if (typeof strings === "string") {
      if (/^\s*(create|alter|drop|truncate)/i.test(strings)) { await db.exec(strings); return []; }
      return (await db.query(strings, vals)).rows;
    }
    let text = "", i = 0;
    for (const s of strings) { text += s; if (i < vals.length) text += `$${++i}`; }
    return (await db.query(text, vals)).rows;
  };
}

// The same body as ensureReady in test/eval/run.mjs.
async function ensureReady(sql) {
  const made = [];
  await migrate(sql);
  await sql`insert into company (id) values (1) on conflict do nothing`;
  await sql`insert into authority (id) values (1) on conflict do nothing`;
  const has = async (tb) => Number((await sql(`select count(*)::int as n from ${tb}`))[0].n);

  if (!(await has("policy_versions"))) {
    await sql`insert into policy_versions (version, body, note) values (1, ${SEED.POLICY_V1}, 'Loaded by the eval runner')`;
    made.push("the starter policy");
  }
  if (!(await has("gl_accounts"))) {
    for (const g of SEED.GL_ACCOUNTS)
      await sql`insert into gl_accounts (code,name,type,guidance) values (${g[0]},${g[1]},${g[2]},${g[3]}) on conflict do nothing`;
    made.push(`${SEED.GL_ACCOUNTS.length} accounts`);
  }
  if (!(await has("cost_centers"))) {
    for (const c of SEED.COST_CENTERS)
      await sql`insert into cost_centers (code,name) values (${c[0]},${c[1]}) on conflict do nothing`;
    made.push(`${SEED.COST_CENTERS.length} cost centres`);
  }
  if (!(await has("employees"))) {
    for (const e of SEED.EMPLOYEES)
      await sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
        values (${e[0]},${e[1]},${e[2]},${e[3]},${e[4]},${e[5]},${e[6]},${e[7]}) on conflict do nothing`;
    made.push(`${SEED.EMPLOYEES.length} people`);
  }
  const pol = await sql`select version, body from policy_versions order by version desc limit 1`;
  const usingStarter = String(pol[0].body).trim() === SEED.POLICY_V1.trim();
  if (!(await has("eval_cases")) && usingStarter) {
    for (const ev of SEED.EVAL_CASES)
      await sql`insert into eval_cases (label,payload,expect_verdict,note)
        values (${ev[0]}, ${JSON.stringify(ev[1])}, ${ev[2]}, ${ev[3]})`;
    made.push(`${SEED.EVAL_CASES.length} golden cases`);
  }
  return { made, usingStarter, goldenCount: await has("eval_cases"), policyVersion: pol[0].version };
}

console.log("\nA completely empty database, which is what npm run fresh leaves behind");
{
  const db = new PGlite(); const sql = client(db);
  const r = await ensureReady(sql);
  t("does not throw", true);
  t("created what the suites need", r.made.length === 5, r.made.join(", "));
  t("a policy is on file", (await sql`select count(*)::int n from policy_versions`)[0].n === 1);
  t("accounts for the closing suite", (await sql`select count(*)::int n from gl_accounts`)[0].n === 12);
  t("people for the closing suite", (await sql`select count(*)::int n from employees`)[0].n === 6);
  t("golden cases for the golden suite", r.goldenCount === 24, `${r.goldenCount}`);
  // The closing suite looks up the employee named on each case.
  for (const c of [["E-1001"],["E-1003"],["E-1006"]]) {
    const e = await sql`select id from employees where id = ${c[0]}`;
    t(`closing suite can resolve ${c[0]}`, e.length === 1);
  }
}

console.log("\nRunning twice must not duplicate anything");
{
  const db = new PGlite(); const sql = client(db);
  await ensureReady(sql);
  const second = await ensureReady(sql);
  t("second run creates nothing", second.made.length === 0, second.made.join(", ") || "nothing");
  t("still one policy", (await sql`select count(*)::int n from policy_versions`)[0].n === 1);
  t("still 24 golden cases", (await sql`select count(*)::int n from eval_cases`)[0].n === 24);
  t("still 12 accounts", (await sql`select count(*)::int n from gl_accounts`)[0].n === 12);
}

console.log("\nA customer's own policy is never overwritten");
{
  const db = new PGlite(); const sql = client(db);
  await migrate(sql);
  await sql`insert into policy_versions (version, body, note) values (1, ${"# Our own policy\n4.1 Hotels capped at INR 20,000."}, 'theirs')`;
  const r = await ensureReady(sql);
  t("their policy survives", (await sql`select body from policy_versions order by version desc limit 1`)[0].body.includes("20,000"));
  t("only one version", (await sql`select count(*)::int n from policy_versions`)[0].n === 1);
  t("no golden set is loaded against a policy it was not written for", r.goldenCount === 0);
  t("the runner knows to say so", r.usingStarter === false);
}

console.log("\nThe runner and this test run the same sequence");
{
  const src = fs.readFileSync("test/eval/run.mjs", "utf8");
  const body = src.slice(src.indexOf("async function ensureReady"), src.indexOf("const args ="));
  for (const needle of ["MIGRATE.migrate(sql", "SEED.POLICY_V1", "SEED.GL_ACCOUNTS", "SEED.COST_CENTERS",
                        "SEED.EMPLOYEES", "SEED.EVAL_CASES", "usingStarter"])
    t(`runner does: ${needle}`, body.includes(needle));
}

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
