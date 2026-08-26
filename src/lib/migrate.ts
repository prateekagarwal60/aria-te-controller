import { DDL } from "./schema";
import { spendDateFrom } from "./dates";

/**
 * Everything that has to happen to a database before it is usable, in one place.
 *
 * The schema was applied by two callers that had drifted: the web route and the
 * evaluation runner each ran the DDL, and only the web route filled in a column
 * that had just been added. Running the evaluation against a database it had
 * itself prepared would have left that column empty and the behaviour unchanged,
 * which is the same shape of failure the backfill was written to correct.
 *
 * Applying the statements is not enough on its own. A migration that changes a
 * shape has to fill it for the rows already in it.
 */
export async function migrate(
  sql: any,
  log: (s: string) => void = () => {}
): Promise<{ statements: number; backfilled: number; error?: string }> {
  for (let i = 0; i < DDL.length; i++) {
    try {
      await sql(DDL[i]);
    } catch (e: any) {
      const first = DDL[i].trim().split("\n")[0].slice(0, 90);
      return {
        statements: i,
        backfilled: 0,
        error: `Statement ${i + 1} of ${DDL.length} failed: ${first} — ${e.message}`,
      };
    }
  }

  /* Receipts written before spend_date existed have it null, so the match window
     falls back to when the row arrived. A receipt uploaded three weeks after a
     trip, or a corpus seeded after the fact, would never match its own charge. */
  let backfilled = 0;
  try {
    const undated: any = await sql`
      select id, raw_text from receipts where spend_date is null and raw_text is not null`;
    for (const r of undated) {
      const d = spendDateFrom(r.raw_text);
      if (!d) continue;                       // no date on it, leave it alone
      await sql`update receipts set spend_date = ${d} where id = ${r.id}`;
      backfilled += 1;
    }
    if (backfilled) log(`read a date off ${backfilled} receipt(s) that had none`);
  } catch {
    /* The column may not exist on a database part-way through an upgrade. */
  }

  return { statements: DDL.length, backfilled };
}
