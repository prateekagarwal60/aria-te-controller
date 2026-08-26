import { fresh } from "@/lib/fresh";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const rows: any = await sql`select * from policy_versions order by version desc limit 1`;
  return fresh({ ok: true, policy: rows[0] || null });
}

/** A policy edit creates a new version. Nothing is overwritten, so every past
 *  decision stays attributable to the text that was live when it was made. */
export async function POST(req: Request) {
  const { body, note } = await req.json();
  const cur: any = await sql`select coalesce(max(version),0) as v from policy_versions`;
  const next = Number(cur[0].v) + 1;
  await sql`insert into policy_versions (version, body, note) values (${next}, ${body}, ${note || "Edited in console"})`;
  return fresh({ ok: true, version: next });
}
