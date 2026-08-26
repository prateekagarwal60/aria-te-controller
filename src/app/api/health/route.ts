import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { think, MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Checks the three things that can be wrong before any real work starts:
 * the database, the key, and whether this particular model will return JSON.
 * Cheaper to find out here than three agents into a case.
 */
export async function GET() {
  const out: any = { model: MODEL, checks: [] };

  try {
    const r: any = await sql`select count(*)::int as n from transactions`;
    out.checks.push({ name: "database", ok: true, detail: `${r[0].n} charges in the corpus` });
  } catch (e: any) {
    out.checks.push({ name: "database", ok: false, detail: e.message });
    return NextResponse.json({ ok: false, ...out });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    out.checks.push({ name: "api key", ok: false, detail: "ANTHROPIC_API_KEY is not set." });
    return NextResponse.json({ ok: false, ...out });
  }
  out.checks.push({ name: "api key", ok: true, detail: "present" });

  const t0 = Date.now();
  try {
    const { json, usage } = await think({
      agent: "health",
      system: 'Return exactly {"ok":true,"note":"reachable"}.',
      content: "Health check.",
      maxTokens: 64,
    });
    out.checks.push({
      name: `model ${MODEL}`, ok: json?.ok === true,
      detail: `replied in ${Date.now() - t0}ms, ${usage.input_tokens}+${usage.output_tokens} tokens`,
    });
  } catch (e: any) {
    out.checks.push({
      name: `model ${MODEL}`, ok: false, detail: e.message,
      /* Ordered most specific first. An earlier version tested for the word
         "model" and so reported a wrong model name whenever a message merely
         contained it, which sent you looking in the wrong place. */
      hint: /temperature/i.test(e.message)
        ? "This model rejects a temperature parameter. Nothing here sends one, so the running build is stale. Rebuild and restart."
        : /prefill|assistant message/i.test(e.message)
        ? "This model rejects an assistant prefill. Nothing here uses one, so the running build is stale. Rebuild and restart."
        : /authentication|invalid.*api.?key|401|unauthor/i.test(e.message)
        ? "The key was rejected. Check ANTHROPIC_API_KEY."
        : /not_found_error|model.*not.*(found|exist)|unknown model/i.test(e.message)
        ? `No model called "${MODEL}" is reachable with this key. Set ARIA_MODEL to one that is.`
        : /rate.?limit|429/i.test(e.message)
        ? "Rate limited. Wait and try again."
        : /credit|billing|quota/i.test(e.message)
        ? "The account is out of credit."
        : undefined,
    });
    return NextResponse.json({ ok: false, ...out });
  }

  return NextResponse.json({ ok: out.checks.every((c: any) => c.ok), ...out });
}
