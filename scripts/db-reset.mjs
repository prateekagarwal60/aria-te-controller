/**
 * Wipes the database.
 *
 *   npm run fresh             drop every table, back to a first install
 *   npm run db:reset          same thing
 *   npm run db:reset -- work  keep the hire, clear only the work
 *
 * Reads .env.local itself, so it does not depend on --env-file and works on any
 * Node 18 or later.
 */
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

function envFromFile() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}
envFromFile();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set and no .env.local was found in this directory.");
  process.exit(1);
}
const sql = neon(url);
const host = url.split("@")[1]?.split("/")[0] || "the database";
const scope = process.argv[2] === "work" ? "work" : "everything";

// Ordered so that dependents go before the tables they reference.
const TABLES = [
  "journal_lines", "journal_entries", "decision_log", "guardrail_events",
  "agent_runs", "escalations", "precedents", "cases", "transactions",
  "receipts", "calendar_events", "trips", "eval_runs", "eval_cases",
  "policy_versions", "employees", "gl_accounts", "cost_centers",
  "authority", "company",
];

if (scope === "work") {
  console.log(`\nClearing work on ${host}. The hire, policy, books and people stay.\n`);
  await sql`truncate journal_lines, journal_entries, decision_log, guardrail_events,
            agent_runs, escalations, precedents, cases, transactions, receipts,
            calendar_events, trips, eval_runs restart identity cascade`;
  console.log("Done. Load the app and the queue is empty.\n");
} else {
  console.log(`\nDropping every table on ${host}.\n`);
  let dropped = 0;
  for (const t of TABLES) {
    await sql(`drop table if exists ${t} cascade`);
    dropped++;
    process.stdout.write(`  ${t}\n`);
  }

  // Anything left behind would be silently carried into the next run, so say so.
  const left = await sql`
    select tablename from pg_tables where schemaname = 'public' order by tablename`;
  if (left.length) {
    console.log(`\n  ${left.length} table(s) not owned by this app were left alone: ${left.map(r => r.tablename).join(", ")}`);
  }
  console.log(`\n${dropped} tables dropped. Load the app: it will rebuild the schema and start at hiring.\n`);
}
