import { NextResponse } from "next/server";
import { sql, money } from "@/lib/db";
import {
  runGather, runCorroborate, runDecide,
  applyAuthority, runPost, writeToLedger,
} from "@/lib/agents";
import { assertMayWork, appendDecision } from "@/lib/agents/guardrails";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ORDER = ["gather", "corroborate", "decide", "authorise", "post"] as const;

export async function POST(req: Request) {
  const { caseId, step } = await req.json();
  try {
    // Pause and spend cap are checked before any work starts, so a stopped
    // agent stops cleanly rather than halfway through a case.
    await assertMayWork(caseId);

    const rows: any = await sql`
      select c.*, t.* , c.id as case_id, c.status as case_status
      from cases c join transactions t on t.id = c.transaction_id where c.id = ${caseId}`;
    if (!rows.length) {
      /* The lookup is a join, so an empty result means the case is missing, or the
         charge it points at is, or the request reached a different database from
         the one the screen was drawn from. "No such case" could not tell them
         apart, which made a deployment pointing at the wrong database look
         identical to a corrupt row. */
      const c: any = await sql`select transaction_id from cases where id = ${caseId}`;
      if (!c.length) {
        const n: any = await sql`select count(*)::int as n from cases`;
        return NextResponse.json({ ok: false, error:
          `No charge called ${caseId} in this database, which holds ${n[0].n}. ` +
          `If the screen is showing it, this request reached a different database.` }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error:
        `${caseId} points at charge ${c[0].transaction_id}, which is not in this database.` },
        { status: 404 });
    }

    const row = rows[0];
    const txn = {
      id: row.transaction_id, employee_id: row.employee_id, merchant: row.merchant,
      mcc: row.mcc, amount: Number(row.amount), currency: row.currency,
      amount_inr: Number(row.amount_inr), txn_date: row.txn_date, txn_time: row.txn_time,
      card_last4: row.card_last4, source: row.source, memo: row.memo,
    };

    if (step === "gather") {
      await sql`update cases set status='working' where id=${caseId}`;
      const { assembled, receipt, read } = await runGather(caseId, txn);
      await sql`update cases set assembled=${JSON.stringify({ ...assembled, receipt_snapshot: receipt })} where id=${caseId}`;
      return NextResponse.json({ ok: true, step, result: assembled, read, next: "corroborate" });
    }

    if (step === "corroborate") {
      const assembled = row.assembled || {};
      const receipt = assembled.receipt_snapshot || null;
      const inv = await runCorroborate(caseId, txn, receipt, assembled);
      await sql`update cases set investigation=${JSON.stringify(inv)}, risk_band=${inv.risk_band},
                risk_score=${inv.risk_score} where id=${caseId}`;
      return NextResponse.json({ ok: true, step, result: inv, read: inv.read, next: "decide" });
    }

    if (step === "decide") {
      const emp: any = await sql`select * from employees where id=${txn.employee_id}`;
      const adj = await runDecide(caseId, txn, row.assembled || {}, row.investigation || {}, emp[0]);
      await sql`update cases set adjudication=${JSON.stringify(adj)}, verdict=${adj.verdict},
                confidence=${adj.confidence}, amount_allowed=${money(adj.amount_allowed ?? txn.amount_inr)},
                policy_version=${adj.policy_version} where id=${caseId}`;
      return NextResponse.json({ ok: true, step, result: adj, read: adj.read, next: "authorise" });
    }

    if (step === "authorise") {
      const adj = row.adjudication || {};
      const inv = row.investigation || {};
      const gate = await applyAuthority(adj, inv, txn);
      await sql`update cases set authority=${JSON.stringify(gate)} where id=${caseId}`;
      const gateRead = "no model call, six checks in code";

      if (!gate.acted) {
        const open: any = await sql`select id from escalations where case_id=${caseId} and status='open'`;
        if (!open.length) {
          /* Two different things used to be stored identically.
             When she reached a view and is only asking permission, "did you agree
             with her" is a real question. When she could not reach one, there is
             nothing to agree with: you are answering, not reviewing. Counting the
             second as an overturn made every answer read as a disagreement. */
          const hasView = adj.verdict && adj.verdict !== "ESCALATE";
          const kind = hasView ? "permission" : "question";
          const question = hasView
            ? `She would ${adj.verdict === "APPROVE" ? "allow this in full"
                : adj.verdict === "PARTIAL" ? `allow ${money(adj.amount_allowed)} of ${money(txn.amount_inr)}`
                : "disallow this"}. Confirm it or decide differently.`
            : (adj.question_for_controller ||
               `She cannot settle this ${txn.currency} ${txn.amount} charge at ${txn.merchant} on the record she has. What should happen?`);

          await sql`insert into escalations (case_id, reason, question, recommendation, aria_verdict, kind, proposed_allowed)
            values (${caseId}, ${gate.reasons.join(" ")}, ${question},
                    ${adj.recommendation || adj.reasoning || null},
                    ${hasView ? adj.verdict : null}, ${kind},
                    ${hasView ? money(adj.amount_allowed ?? txn.amount_inr) : null})`;
        }
        await sql`update cases set status='escalated' where id=${caseId}`;
        await appendDecision(caseId, "escalated", { reasons: gate.reasons, mode: gate.mode, verdict: adj.verdict, confidence: adj.confidence });
        return NextResponse.json({ ok: true, step, result: gate, read: gateRead, next: null, outcome: "escalated" });
      }

      if (gate.action === "REJECT") {
        await sql`update cases set status='rejected', closed_at=now() where id=${caseId}`;
        await appendDecision(caseId, "disallowed", { amount_inr: txn.amount_inr, merchant: txn.merchant, reasoning: adj.reasoning, clauses: adj.clauses });
        return NextResponse.json({ ok: true, step, result: gate, read: gateRead, next: null, outcome: "rejected" });
      }
      return NextResponse.json({ ok: true, step, result: gate, read: gateRead, next: "post", outcome: "approved" });
    }

    if (step === "post") {
      const emp: any = await sql`select * from employees where id=${txn.employee_id}`;
      // If a Controller resolved an escalation, the amount they allowed wins over
      // the figure Aria originally proposed.
      const effective = {
        ...(row.adjudication || {}),
        amount_allowed: row.amount_allowed ?? row.adjudication?.amount_allowed ?? txn.amount_inr,
      };
      const closing = await runPost(caseId, txn, row.assembled || {}, effective, emp[0]);
      if (!closing.balanced) {
        await sql`update cases set closing=${JSON.stringify(closing)}, status='escalated' where id=${caseId}`;
        await sql`insert into escalations (case_id, reason, question, recommendation)
          values (${caseId}, 'Journal entry did not balance and was not posted.',
                  'The coding step produced unbalanced lines. Confirm the correct treatment.',
                  ${closing.rationale || null})`;
        return NextResponse.json({ ok: true, step, result: closing, next: null, outcome: "escalated" });
      }
      const entry = await writeToLedger(caseId, closing);
      await sql`update cases set closing=${JSON.stringify({ ...closing, entry_ref: entry.entry_ref })},
                status='settled', closed_at=now() where id=${caseId}`;
      await appendDecision(caseId, "posted", { entry_ref: entry.entry_ref, lines: closing.lines, totals: closing.totals });
      return NextResponse.json({ ok: true, step, result: { ...closing, entry_ref: entry.entry_ref }, read: closing.read, next: null, outcome: "settled" });
    }

    return NextResponse.json({ ok: false, error: "Unknown step." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, step }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ steps: ORDER });
}
