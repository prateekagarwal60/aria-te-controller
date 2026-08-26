import { NextResponse } from "next/server";
import { sql, newId, money } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FX: Record<string, number> = { INR: 1, USD: 87.4, SGD: 64.98, AED: 23.0, EUR: 94.6, GBP: 111.2 };

export async function POST(req: Request) {
  const b = await req.json();
  try {
    const id = newId("X");
    const cur = (b.currency || "INR").toUpperCase();
    const amt = money(b.amount);
    const inr = cur === "INR" ? amt : money(amt * (FX[cur] || 1));

    await sql`insert into transactions (id, employee_id, merchant, mcc, amount, currency, amount_inr,
                txn_date, txn_time, card_last4, source, memo)
      values (${id}, ${b.employee_id}, ${b.merchant}, ${b.mcc || null}, ${amt}, ${cur}, ${inr},
              ${b.txn_date}, ${b.txn_time || null}, ${b.card_last4 || null},
              ${b.source || "card_feed"}, ${b.memo || null})`;

    const caseId = "CASE-" + id.slice(2);
    await sql`insert into cases (id, transaction_id, status) values (${caseId}, ${id}, 'queued')`;

    /* An upload has already created a receipt row. Creating a second one from the
       same text made the corpus contain the claimant's own document twice, so the
       reuse check fired against the person who had uploaded it once, and Gather
       was handed two competing candidates of which only one carried the extracted
       fields. Link to what exists; only create when nothing does. */
    let receiptId: string | null = b.receipt_id || null;
    if (!receiptId && b.receipt_text && b.receipt_text.trim()) {
      const { contentHash } = await import("@/lib/agents/signals");
      const hash = contentHash(b.receipt_text);
      const existing: any = await sql`
        select id from receipts where employee_id = ${b.employee_id} and content_hash = ${hash}
        order by created_at desc limit 1`;
      if (existing.length) {
        receiptId = existing[0].id;
      } else {
        receiptId = newId("R");
        await sql`insert into receipts (id, employee_id, source, raw_text, content_hash)
          values (${receiptId}, ${b.employee_id}, 'upload', ${b.receipt_text}, ${hash})`;
      }
    }
    return NextResponse.json({ ok: true, id, caseId, receiptId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await sql`delete from cases where transaction_id = ${id}`;
  await sql`delete from transactions where id = ${id}`;
  return NextResponse.json({ ok: true });
}
