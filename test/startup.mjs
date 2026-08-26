// React runs effects twice in development, so two startups arrive at once. A
// boolean guard meant the second reported failure before the first had prepared
// anything, and the console showed "relation company does not exist" on a
// database that was about to be created correctly.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const src = fs.readFileSync("src/lib/schema.ts", "utf8");
const DDL = [...src.matchAll(/`([\s\S]*?)`,\n/g)].map((m) => m[1]);
const VERSION = Number(src.match(/SCHEMA_VERSION = (\d+)/)[1]);

console.log("\nThe schema applies from nothing, exactly as the route applies it");
{
  const db = new PGlite();
  let failedAt = -1;
  for (let i = 0; i < DDL.length; i++) {
    try { await db.exec(DDL[i]); } catch { failedAt = i; break; }
  }
  t("every statement applies", failedAt === -1, failedAt === -1 ? `${DDL.length} statements` : `stopped at ${failedAt + 1}`);
  await db.exec("insert into company (id) values (1) on conflict do nothing");
  await db.exec(`update company set schema_version = ${VERSION} where id = 1`);
  const c = (await db.query("select schema_version from company where id=1")).rows[0];
  t("and the version is recorded, so state is satisfied", Number(c.schema_version) === VERSION);
  t("no second bootstrap is asked for", !(Number(c.schema_version ?? 0) < VERSION),
    "an unset version here is the loop that produced the error");
}

// The startup logic, run twice at once the way an effect fires twice.
async function startup({ guard }) {
  let prepared = false, calls = 0, reported = null;
  const state = async () => prepared ? { ok: true } : { ok: false, needsBootstrap: true, error: "relation \"company\" does not exist" };
  const bootstrap = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); prepared = true; return { ok: true }; };

  if (guard === "boolean") {
    let flag = false;
    const load = async () => {
      const r = await state();
      if (!r.ok && r.needsBootstrap) {
        if (flag) { reported = r.error; return; }
        flag = true;
        await bootstrap();
        return load();
      }
    };
    await Promise.all([load(), load()]);
  } else {
    let inflight = null, attempts = 0;
    const load = async () => {
      const r = await state();
      if (!r.ok && r.needsBootstrap) {
        if (attempts >= 2) { reported = r.error; return; }
        attempts++;
        if (!inflight) inflight = bootstrap();
        const b = await inflight;
        inflight = null;
        if (b && b.ok === false) { reported = b.error; return; }
        return load();
      }
    };
    await Promise.all([load(), load()]);
  }
  return { reported, calls, prepared };
}

console.log("\nTwo startups at once, which is what a development effect does");
const withBoolean = await startup({ guard: "boolean" });
t("a boolean guard reports a failure that did not happen", withBoolean.reported !== null,
  `reported: ${withBoolean.reported}`);

const withShared = await startup({ guard: "shared" });
t("sharing one request reports nothing", withShared.reported === null);
t("the database is prepared", withShared.prepared);
t("and it is prepared once, not twice", withShared.calls === 1, `${withShared.calls} call`);

console.log("\nA real failure is still reported rather than retried forever");
{
  let attempts = 0, reported = null, inflight = null;
  const load = async () => {
    const r = { ok: false, needsBootstrap: true, error: "state says no" };
    if (attempts >= 2) { reported = r.error; return; }
    attempts++;
    if (!inflight) inflight = Promise.resolve({ ok: false, error: "statement 7 failed" });
    const b = await inflight; inflight = null;
    if (b && b.ok === false) { reported = b.error; return; }
    return load();
  };
  await load();
  t("the bootstrap message is shown, not the state message", reported === "statement 7 failed",
    "the real cause used to be replaced by whatever the previous call said");
}

console.log("\nThe wiring");
const page = fs.readFileSync("src/app/page.tsx", "utf8");
const boot = fs.readFileSync("src/app/api/bootstrap/route.ts", "utf8");
t("startups share one request", /if \(!bootstrapping\.current\)/.test(page));
t("the reply is read", /if \(b && b\.ok === false\)/.test(page));
t("no boolean guard is left", !/bootstrapped\.current/.test(page));
t("there is still a limit", /attempts\.current >= 2/.test(page));
/* The message moved into the routine both callers share, so that is where it
   is asserted now. */
const mig = fs.readFileSync("src/lib/migrate.ts", "utf8");
t("the migration names the statement that failed", /Statement \$\{i \+ 1\} of \$\{DDL\.length\} failed/.test(mig));
t("and hands it back rather than throwing", /return \{\s*\n?\s*statements: i,/.test(mig));
t("the route passes it through", /Could not prepare the database\. \$\{r\.error\}/.test(boot));
t("and does not take the route down with it", /status: 200/.test(boot));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
