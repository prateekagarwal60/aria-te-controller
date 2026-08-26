import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SCHEMA_VERSION } from "@/lib/schema";
import { migrate } from "@/lib/migrate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Creates the schema and nothing else. No employees, no charges, no policy.
 * An agent that arrives already holding a queue nobody gave it is a demo.
 * Everything the agent knows comes from onboarding, which is /api/onboard.
 */
export async function POST() {
  /* One routine, shared with the evaluation runner. They used to apply the schema
     separately and had already drifted: only this one filled in a column the other
     had just added. */
  const r = await migrate(sql, (m) => console.log(`[bootstrap] ${m}`));
  if (r.error) return NextResponse.json({ ok: false, error: `Could not prepare the database. ${r.error}` }, { status: 200 });

  try {
    await sql`insert into company (id) values (1) on conflict do nothing`;
    await sql`insert into authority (id) values (1) on conflict do nothing`;
    await sql`update company set schema_version = ${SCHEMA_VERSION} where id = 1`;
    const c: any = await sql`select onboarded_at from company where id = 1`;
    return NextResponse.json({
      ok: true, onboarded: !!c[0]?.onboarded_at, schema: SCHEMA_VERSION, backfilled: r.backfilled,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Could not prepare the database: ${e.message}` }, { status: 200 });
  }
}
