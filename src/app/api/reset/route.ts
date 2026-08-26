import { fresh } from "@/lib/fresh";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-queues work without destroying the precedent book, so you can re-run the
 *  same corpus against an edited policy and watch the outcomes move. */
export async function POST(req: Request) {
  const { scope } = await req.json().catch(() => ({ scope: "cases" }));

  if (scope === "everything") {
    await sql`truncate journal_lines, journal_entries, escalations, precedents, agent_runs, eval_runs restart identity cascade`;
  } else {
    await sql`truncate journal_lines, journal_entries restart identity cascade`;
    await sql`delete from escalations`;
    await sql`delete from agent_runs`;
  }
  await sql`update cases set status='queued', verdict=null, confidence=null, risk_band=null, risk_score=null,
            amount_allowed=null, assembled=null, investigation=null, adjudication=null, closing=null,
            authority=null, closed_at=null`;
  return fresh({ ok: true });
}
