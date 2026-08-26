import { NextResponse } from "next/server";
import { sql, money } from "@/lib/db";
import { think } from "@/lib/anthropic";
import { appendDecision } from "@/lib/agents/guardrails";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const rows: any = await sql`
    select es.*, c.transaction_id, t.merchant, t.amount_inr, t.txn_date
    from escalations es join cases c on c.id = es.case_id
    join transactions t on t.id = c.transaction_id order by es.created_at desc`;
  return NextResponse.json({ ok: true, escalations: rows });
}

/**
 * A Controller answers the question. Two things then happen, and the second one
 * is the whole point: the ruling is generalised into a precedent, so the next
 * comparable case is decided without asking anyone.
 */
export async function POST(req: Request) {
  const { escalationId, decision, rationale, amountAllowed, resolvedBy } = await req.json();
  try {
    const rows: any = await sql`
      select es.*, c.id as case_id, c.assembled, c.adjudication, c.investigation,
             t.merchant, t.amount_inr, t.currency, t.amount, t.txn_date, t.memo, t.source
      from escalations es join cases c on c.id = es.case_id
      join transactions t on t.id = c.transaction_id where es.id = ${escalationId}`;
    if (!rows.length) return NextResponse.json({ ok: false, error: "No such escalation." }, { status: 404 });
    const e = rows[0];

    /* Decided once, at the top, before anything is written or learned from.
       It used to be written as the raw button value and overwritten afterwards,
       which left a window where the row held a word nothing else understood and,
       worse, was the window the precedent was generated in. */
    const charged = money(e.amount_inr);
    const allowed = decision === "REJECT" ? 0
      : Math.max(0, Math.min(money(amountAllowed ?? charged), charged));
    const verdict = allowed <= 0.01 ? "REJECT" : allowed >= charged - 0.01 ? "APPROVE" : "PARTIAL";

    await sql`update escalations set status='resolved', human_decision=${verdict},
      human_rationale=${rationale}, resolved_by=${resolvedBy || "Controller"}, resolved_at=now()
      where id=${escalationId}`;

    await appendDecision(e.case_id, "human_ruling", {
      escalationId, decision: verdict, allowed, charged, rationale,
      resolvedBy: resolvedBy || "Controller",
      question: e.question, aria_recommended: e.recommendation,
    });

    // Generalise the ruling. A precedent that only matches one merchant is useless.
    let precedent: any = null;
    try {
      const { json } = await think({
        agent: "record",
        caseId: e.case_id,
        maxTokens: 900,
        system: `You are recording a Controller's ruling so that a comparable case in future is
decided the same way without asking again.

Write the precedent at the right altitude. Too narrow and it never matches again. Too broad and it
overrides policy it was never meant to touch. Capture the feature of the situation that actually
drove the decision, not the incidental details.

Return JSON:
{
  "merchant": string|null,      // only if the merchant itself was the reason
  "category": string,           // the kind of spend this ruling governs
  "amount_band": string,        // e.g. "under INR 10,000", "any amount"
  "situation": string,          // one sentence describing when this precedent applies
  "decision": "APPROVE"|"PARTIAL"|"REJECT",   // PARTIAL where some of the charge was
                                              // allowed and the rest was not, which is
                                              // an ordinary answer rather than a fudge
  "rationale": string           // one or two sentences, in the Controller's voice
}`,
        content: JSON.stringify({
          charge: { merchant: e.merchant, amount_inr: e.amount_inr, date: e.txn_date, memo: e.memo, source: e.source },
          evidence: e.assembled,
          what_aria_asked: e.question,
          aria_recommended: e.recommendation,
          controller_decision: verdict,
          controller_allowed: allowed,
          charge_total: charged,
          controller_rationale: rationale,
        }),
      });
      const p: any = await sql`
        insert into precedents (escalation_id, merchant, category, amount_band, situation, decision, rationale)
        values (${escalationId}, ${json.merchant || null}, ${json.category || null}, ${json.amount_band || null},
                ${json.situation}, ${json.decision}, ${json.rationale}) returning *`;
      precedent = p[0];
    } catch {}

    if (verdict === "REJECT") {
      await sql`update cases set status='rejected', verdict='REJECT', amount_allowed=0,
        closed_at=now() where id=${e.case_id}`;
      return NextResponse.json({ ok: true, precedent, caseId: e.case_id, verdict, readyToClose: false });
    }
    await sql`update cases set status='queued', verdict=${verdict}, amount_allowed=${allowed}
      where id=${e.case_id}`;
    return NextResponse.json({ ok: true, precedent, caseId: e.case_id, verdict, readyToClose: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}
