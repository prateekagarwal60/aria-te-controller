import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { think } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const cases: any = await sql`select * from eval_cases order by id`;
  const runs: any = await sql`select * from eval_runs order by started_at desc limit 10`;
  return NextResponse.json({ ok: true, cases, runs });
}

/**
 * The golden set is scored against whatever policy is live right now. Edit the policy
 * and the score moves, which is the point: this measures the agent's judgment, not a
 * fixed answer key baked into the code.
 */
export async function POST(req: Request) {
  const { offset = 0, limit = 6, runId = null } = await req.json().catch(() => ({}));
  try {
    const pol: any = await sql`select version, body from policy_versions order by version desc limit 1`;
    const cases: any = await sql`select * from eval_cases order by id offset ${offset} limit ${limit}`;
    const total: any = await sql`select count(*)::int as n from eval_cases`;

    const results: any[] = [];
    for (const c of cases) {
      const t0 = Date.now();
      try {
        const { json, usage } = await think({
          agent: "eval",
          maxTokens: 900,
          system: `You are Aria, the Travel and Expense Controller.
Adjudicate the charge below against the policy document. The policy is the whole of the law.
Quote the clause you relied on. If the policy is silent, say so and return ESCALATE.
Return JSON: {"verdict":"APPROVE"|"REJECT"|"ESCALATE","confidence":0.0-1.0,"clause":string,"reasoning":string}`,
          content: JSON.stringify({ policy_document: pol[0].body, charge: c.payload }),
        });
        const correct = String(json.verdict).toUpperCase() === String(c.expect_verdict).toUpperCase();
        results.push({
          id: c.id, label: c.label, expected: c.expect_verdict, got: json.verdict,
          correct, confidence: json.confidence, clause: json.clause, reasoning: json.reasoning,
          note: c.note, latency_ms: Date.now() - t0,
          cost: (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000,
        });
      } catch (e: any) {
        results.push({ id: c.id, label: c.label, expected: c.expect_verdict, got: "ERROR",
          correct: false, error: e.message, latency_ms: Date.now() - t0, cost: 0 });
      }
    }

    const done = offset + cases.length >= total[0].n;
    let run = runId;

    if (offset === 0) {
      const r: any = await sql`insert into eval_runs (policy_version, total, correct, escalations, avg_latency_ms, total_cost_usd, detail)
        values (${pol[0].version}, ${total[0].n}, 0, 0, 0, 0, ${JSON.stringify(results)}) returning id`;
      run = r[0].id;
    } else if (runId) {
      const prev: any = await sql`select detail from eval_runs where id = ${runId}`;
      const merged = [...(prev[0]?.detail || []), ...results];
      await sql`update eval_runs set detail = ${JSON.stringify(merged)} where id = ${runId}`;
    }

    if (done && run) {
      const prev: any = await sql`select detail from eval_runs where id = ${run}`;
      const all = prev[0]?.detail || results;
      const correct = all.filter((r: any) => r.correct).length;
      const escal = all.filter((r: any) => String(r.got).toUpperCase() === "ESCALATE").length;
      const avg = Math.round(all.reduce((s: number, r: any) => s + (r.latency_ms || 0), 0) / all.length);
      const cost = all.reduce((s: number, r: any) => s + (r.cost || 0), 0);
      await sql`update eval_runs set correct=${correct}, escalations=${escal},
        avg_latency_ms=${avg}, total_cost_usd=${cost} where id=${run}`;
    }

    return NextResponse.json({
      ok: true, runId: run, results, done,
      progress: { done: offset + cases.length, total: total[0].n },
      policyVersion: pol[0].version,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
