import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows: any = await sql`select * from authority where id = 1`;
  return NextResponse.json({ ok: true, authority: rows[0] });
}

export async function POST(req: Request) {
  const b = await req.json();
  await sql`update authority set
    auto_approve_limit = ${b.auto_approve_limit},
    auto_reject_limit  = ${b.auto_reject_limit},
    min_confidence     = ${b.min_confidence},
    escalate_risk_at   = ${b.escalate_risk_at},
    can_post_ledger    = ${b.can_post_ledger},
    can_reject         = ${b.can_reject},
    updated_at = now() where id = 1`;
  const rows: any = await sql`select * from authority where id = 1`;
  return NextResponse.json({ ok: true, authority: rows[0] });
}
