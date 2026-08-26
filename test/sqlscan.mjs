// Pull every tagged-template SQL literal out of the source and run it against a
// real Postgres with placeholder parameters. This catches the whole class of bug
// the Gather step hit: a query that typechecks, builds, and fails only when Postgres
// tries to resolve an operator at run time.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const db = new PGlite();
const ddl = fs.readFileSync("src/lib/schema.ts", "utf8");
for (const m of [...ddl.matchAll(/`([\s\S]*?)`,\n/g)]) await db.exec(m[1]);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

// Values chosen so each placeholder is plausible for the column it lands beside.
const guess = (expr) => {
  if (/txn_date|starts_on|ends_on|_date\b|date\b/i.test(expr)) return "2026-08-04";
  if (/W\.\w+|limit|offset|\b\d+\b/.test(expr) && !/\./.test(expr)) return 3;
  if (/JSON\.stringify/.test(expr)) return "{}";
  if (/true|false/.test(expr)) return true;
  if (/amount|cost|conf|score|tok|latency|version|budget/i.test(expr)) return 1;
  return "x";
};

let found = 0, ran = 0, failed = 0;
const skip = /truncate|drop table|create table|create index|alter table/i;

for (const file of walk("src")) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/sql`([\s\S]*?)`/g)) {
    const raw = m[1];
    if (skip.test(raw)) continue;
    found++;
    const params = [];
    let i = 0;
    const text = raw.replace(/\$\{([\s\S]*?)\}/g, (_, expr) => {
      params.push(guess(expr));
      return `$${++i}`;
    });
    try {
      await db.query(text, params);
      ran++;
    } catch (e) {
      // A missing row or a constraint is fine. An unresolvable operator is not.
      if (/operator does not exist|does not exist: |cannot be matched|could not determine/i.test(e.message)) {
        failed++;
        console.log(`\n  FAIL ${file}`);
        console.log(`       ${e.message}`);
        console.log(`       ${text.trim().split("\n")[0].slice(0, 90)}`);
      } else ran++;
    }
  }
}
console.log(`\n  ${found} SQL literals found, ${ran} resolved, ${failed} with unresolvable operators\n`);
process.exit(failed ? 1 : 0);
