import { fresh } from "@/lib/fresh";
import { sql } from "@/lib/db";
import { operatingState } from "@/lib/agents/guardrails";
import { SCHEMA_VERSION } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // Until the agent has been hired there is nothing to show, and the console
    // renders onboarding instead. Cheapest possible check, done first.
    const co: any = await sql`select * from company where id = 1`;

    /* A database that already worked never used to receive a new column, because
       the schema was only applied when a query had already failed. Anything added
       after the first bootstrap silently did not exist. */
    if (!co.length || Number(co[0].schema_version ?? 0) < SCHEMA_VERSION) {
      return fresh({ ok: false, needsBootstrap: true,
        error: `Database is at schema ${co[0]?.schema_version ?? 0}, this build needs ${SCHEMA_VERSION}.` });
    }
    if (!co.length || !co[0].onboarded_at) {
      const emp: any = await sql`select * from employees order by name`;
      return fresh({ ok: true, onboarded: false, company: co[0] || null, employees: emp });
    }

    const cases: any = await sql`
      select c.*, t.merchant, t.amount, t.currency, t.amount_inr, t.txn_date, t.txn_time,
             t.card_last4, t.source, t.memo, t.mcc, t.scenario,
             e.name as employee_name, e.grade, e.department, e.cost_center
      from cases c
      join transactions t on t.id = c.transaction_id
      join employees e on e.id = t.employee_id
      order by t.txn_date desc, c.id`;

    // Which charges a person ruled on, so the console does not offer to spot
    // check a decision the Controller made themselves.
    const humanRuled: any = await sql`
      select distinct case_id from escalations where status = 'resolved'`;
    const ruled = new Set(humanRuled.map((r: any) => r.case_id));
    for (const c of cases) c.decided_by_you = ruled.has(c.id);

    const escalations: any = await sql`
      select es.*, c.transaction_id, t.merchant, t.amount_inr, t.txn_date, e.name as employee_name
      from escalations es
      join cases c on c.id = es.case_id
      join transactions t on t.id = c.transaction_id
      join employees e on e.id = t.employee_id
      order by es.status asc, es.created_at desc`;

    const policy: any = await sql`select version, body, note, created_at from policy_versions order by version desc limit 1`;
    const policyHistory: any = await sql`select version, note, created_at from policy_versions order by version desc limit 20`;
    const authority: any = await sql`select * from authority where id = 1`;
    const precedents: any = await sql`select * from precedents order by created_at desc limit 30`;
    const employees: any = await sql`select * from employees order by name`;
    const accounts: any = await sql`select * from gl_accounts order by code`;
    const centers: any = await sql`select * from cost_centers order by code`;
    const receipts: any = await sql`select id, employee_id, source, raw_text, content_hash, created_at from receipts order by created_at desc limit 60`;
    const evalRuns: any = await sql`select * from eval_runs order by started_at desc limit 10`;
    const evalCount: any = await sql`select count(*)::int as n from eval_cases`;

    const runs: any = await sql`
      select agent, count(*)::int as n, avg(latency_ms)::int as avg_ms, sum(cost_usd) as cost
      from agent_runs group by agent order by agent`;
    const totals: any = await sql`
      select coalesce(sum(cost_usd),0) as cost, coalesce(avg(latency_ms),0)::int as avg_ms,
             count(*)::int as calls from agent_runs`;
    const caseRuns: any = await sql`
      select case_id, agent, model, input_tok, output_tok, latency_ms, cost_usd, ok, error,
             system_prompt, input_payload, raw_output
      from agent_runs order by case_id, id`;

    let governance: any = null;
    try { governance = { state: await operatingState() }; } catch {}

    return fresh({
      ok: true, onboarded: true, company: co[0], cases, escalations, governance,
      policy: policy[0] || null, policyHistory,
      authority: authority[0] || null,
      precedents, employees, accounts, centers, receipts,
      evalRuns, evalCount: evalCount[0]?.n ?? 0,
      meter: { byAgent: runs, totals: totals[0] },
      caseRuns,
    });
  } catch (e: any) {
    return fresh({ ok: false, error: e.message, needsBootstrap: true }, { status: 200 });
  }
}
