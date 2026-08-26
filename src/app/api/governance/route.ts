import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { operatingState, verifyChain } from "@/lib/agents/guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await operatingState();
    const chain = await verifyChain();
    const events: any = await sql`
      select kind, severity, count(*)::int as n, max(created_at) as last
      from guardrail_events group by kind, severity order by n desc`;
    const recent: any = await sql`
      select id, case_id, kind, severity, detail, created_at
      from guardrail_events order by id desc limit 40`;
    const log: any = await sql`
      select id, case_id, event, payload, hash, created_at
      from decision_log order by id desc limit 40`;

    // Where decisions were made relative to the confidence floor. Calibration
    // is the question that decides whether the floor is set anywhere sensible.
    const calib: any = await sql`
      select
        width_bucket(confidence, 0, 1, 10) as bucket,
        count(*)::int as n,
        count(*) filter (where status = 'escalated')::int as escalated
      from cases where confidence is not null group by bucket order by bucket`;

    return NextResponse.json({ ok: true, state, chain, events, recent, log, calibration: calib });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const b = await req.json();
  try {
    if (b.mode) await sql`update authority set mode = ${b.mode}, updated_at = now() where id = 1`;
    if (b.paused !== undefined) await sql`update authority set paused = ${b.paused}, updated_at = now() where id = 1`;
    if (b.trace_enabled !== undefined)
      await sql`update authority set trace_enabled = ${b.trace_enabled}, updated_at = now() where id = 1`;
    if (b.daily_spend_cap_usd !== undefined)
      await sql`update authority set daily_spend_cap_usd = ${b.daily_spend_cap_usd}, updated_at = now() where id = 1`;
    return NextResponse.json({ ok: true, state: await operatingState() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
