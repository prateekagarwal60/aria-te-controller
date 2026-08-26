import { sql } from "../db";
export { SIGNAL_MEANING } from "../signalmeaning";

/**
 * Corroboration signals. Every one of these is a real query against the corpus,
 * not a model guess. We do not claim to detect an AI-generated receipt by looking
 * at it: no reliable image forensic exists. We corroborate the claim against
 * independent records and let the absence of corroboration carry the weight.
 */
export type Signal = {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  detail: string;
  evidence?: any;
};

export async function corroborate(txn: any, receipt: any | null): Promise<Signal[]> {
  const out: Signal[] = [];
  const amt = Number(txn.amount_inr);

  // 1. Near-duplicate: same employee, same merchant, similar amount, within 4 days.
  const dupes: any[] = await sql`
    select id, txn_date, amount_inr from transactions
    where employee_id = ${txn.employee_id}
      and lower(merchant) = lower(${txn.merchant})
      and id <> ${txn.id}
      and abs(amount_inr - ${amt}) <= greatest(1, ${amt} * 0.02)
      and abs(txn_date - ${txn.txn_date}::date) <= 4`;
  if (dupes.length) {
    out.push({
      code: "NEAR_DUPLICATE",
      severity: "high",
      detail: `${dupes.length} transaction(s) at the same merchant for the same amount within four days.`,
      evidence: dupes,
    });
  }

  // 2. Same-day split at one merchant. Classic way to stay under an approval limit.
  const sameDay: any[] = await sql`
    select id, amount_inr from transactions
    where employee_id = ${txn.employee_id}
      and lower(merchant) = lower(${txn.merchant})
      and txn_date = ${txn.txn_date}::date
      and id <> ${txn.id}`;
  if (sameDay.length) {
    const total = sameDay.reduce((s, r) => s + Number(r.amount_inr), amt);
    out.push({
      code: "SAME_DAY_SPLIT",
      severity: "medium",
      detail: `${sameDay.length + 1} charges at this merchant on the same day, totalling INR ${total.toFixed(2)}.`,
      evidence: sameDay,
    });
  }

  // 3. Merchant never seen anywhere in the organisation.
  const seen: any[] = await sql`
    select count(*)::int as n from transactions
    where lower(merchant) = lower(${txn.merchant}) and id <> ${txn.id}`;
  if ((seen[0]?.n ?? 0) === 0) {
    out.push({
      code: "UNSEEN_MERCHANT",
      severity: "low",
      detail: "No other transaction at this merchant anywhere in the organisation.",
    });
  }

  // 4. Does the spend sit inside an approved trip window?
  const trips: any[] = await sql`
    select id, destination, starts_on, ends_on, purpose, budget_inr from trips
    where employee_id = ${txn.employee_id}
      and ${txn.txn_date}::date between starts_on - 1 and ends_on + 1`;
  if (trips.length) {
    out.push({
      code: "IN_TRIP_WINDOW",
      severity: "info",
      detail: `Falls inside approved trip ${trips[0].id} to ${trips[0].destination} (${trips[0].purpose}).`,
      evidence: trips[0],
    });
  } else {
    const anyTrip: any[] = await sql`select count(*)::int as n from trips where employee_id = ${txn.employee_id}`;
    if ((anyTrip[0]?.n ?? 0) > 0) {
      out.push({
        code: "OUTSIDE_TRIP_WINDOW",
        severity: "medium",
        detail: "Employee has approved trips on file, but this date falls outside all of them.",
      });
    }
  }

  // 5. Calendar corroboration for the date.
  const events: any[] = await sql`
    select id, title, starts_at, location, attendees from calendar_events
    where employee_id = ${txn.employee_id}
      and starts_at::date = ${txn.txn_date}::date`;
  if (events.length) {
    out.push({
      code: "CALENDAR_MATCH",
      severity: "info",
      detail: `${events.length} calendar event(s) on this date: ${events.map((e) => e.title).join("; ")}.`,
      evidence: events,
    });
  }

  // 6. Receipt present or absent, and does it agree with the card feed.
  if (!receipt) {
    out.push({
      code: "NO_RECEIPT",
      severity: "medium",
      detail: "No receipt matched to this charge.",
    });
  } else {
    const ex = receipt.extracted || {};
    if (ex.total != null) {
      const rt = Number(ex.total);
      const delta = Math.abs(rt - Number(txn.amount));
      if (delta > Math.max(1, Number(txn.amount) * 0.01)) {
        out.push({
          code: "RECEIPT_AMOUNT_MISMATCH",
          severity: "high",
          detail: `Receipt total ${ex.currency || ""} ${rt} does not match the card charge ${txn.currency} ${txn.amount}.`,
        });
      }
    }
    if (ex.merchant && String(ex.merchant).toLowerCase().slice(0, 5) !== String(txn.merchant).toLowerCase().slice(0, 5)) {
      out.push({
        code: "RECEIPT_MERCHANT_MISMATCH",
        severity: "medium",
        detail: `Receipt names "${ex.merchant}", the card feed names "${txn.merchant}".`,
      });
    }
    if (receipt.content_hash) {
      const hashDupes: any[] = await sql`
        select id, employee_id from receipts
        where content_hash = ${receipt.content_hash} and id <> ${receipt.id}`;
      if (hashDupes.length) {
        out.push({
          code: "RECEIPT_REUSED",
          severity: "high",
          detail: `Identical receipt content already submitted (${hashDupes.map((h) => h.id).join(", ")}).`,
          evidence: hashDupes,
        });
      }
    }
  }

  // 7. Orphan claim: a receipt with no independent card record at all.
  if (receipt && txn.source === "employee_claim") {
    const card: any[] = await sql`
      select id from transactions
      where employee_id = ${txn.employee_id} and source = 'card_feed'
        and abs(amount_inr - ${amt}) <= greatest(1, ${amt} * 0.02)
        and abs(txn_date - ${txn.txn_date}::date) <= 3`;
    if (!card.length) {
      out.push({
        code: "NO_INDEPENDENT_RECORD",
        severity: "high",
        detail: "Reimbursement claim with no corresponding card or bank record. The receipt is the only evidence the spend happened.",
      });
    }
  }

  // 8. Round-number tell. Weak on its own, meaningful in combination.
  if (amt >= 500 && amt % 100 === 0) {
    out.push({
      code: "ROUND_AMOUNT",
      severity: "low",
      detail: `Amount is an exact multiple of 100 (INR ${amt}).`,
    });
  }

  // 9. Velocity at one merchant across the trailing month.
  const vel: any[] = await sql`
    select count(*)::int as n from transactions
    where employee_id = ${txn.employee_id}
      and lower(merchant) = lower(${txn.merchant})
      and txn_date between ${txn.txn_date}::date - 30 and ${txn.txn_date}::date`;
  if ((vel[0]?.n ?? 0) >= 6) {
    out.push({
      code: "HIGH_VELOCITY",
      severity: "medium",
      detail: `${vel[0].n} charges at this merchant in the trailing 30 days.`,
    });
  }

  return out;
}

/** Deterministic hash so a resubmitted receipt is caught even after re-encoding. */
export function contentHash(s: string): string {
  const norm = (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < norm.length; i++) {
    h1 = Math.imul(h1 ^ norm.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + norm.charCodeAt(i) * (i + 1), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
