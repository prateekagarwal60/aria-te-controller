import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { appendDecision } from "@/lib/agents/guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Spot checking a charge she settled on her own.
 *
 * Without this the touchless figure is a claim nobody can check, and only half of
 * escalation accuracy is visible: the overturn rate catches her sending you things
 * you would have decided the same way, and nothing catches the opposite, which is
 * the half that costs money.
 *
 * Agreeing is recorded as firmly as disagreeing. A count of checks that all agreed
 * is the evidence for leaving the rest alone.
 */
export async function POST(req: Request) {
  const { caseId, agreed, note } = await req.json();
  try {
    const rows: any = await sql`select id, status, verdict from cases where id = ${caseId}`;
    if (!rows.length) return NextResponse.json({ ok: false, error: "No such charge." }, { status: 404 });

    await sql`update cases set reviewed_at = now(), review_agreed = ${!!agreed},
              review_note = ${note || null} where id = ${caseId}`;
    await appendDecision(caseId, agreed ? "review_agreed" : "review_disagreed",
      { was: rows[0].verdict, note: note || null });

    if (agreed) return NextResponse.json({ ok: true, reopened: false });

    /* Disagreement reopens the charge as something waiting on you, using the same
       route any escalation takes, so a reversal lands in the ledger and the
       precedent book the same way every other decision does. */
    const open: any = await sql`select id from escalations where case_id = ${caseId} and status = 'open'`;
    if (!open.length) {
      await sql`insert into escalations (case_id, reason, question, recommendation, aria_verdict)
        values (${caseId}, 'Reopened by the Controller on review.',
                ${note || "You disagreed with how this was settled. What is the right treatment?"},
                ${null}, ${rows[0].verdict})`;
    }
    await sql`update cases set status = 'escalated' where id = ${caseId}`;
    return NextResponse.json({ ok: true, reopened: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
