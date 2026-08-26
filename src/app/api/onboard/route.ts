import { fresh } from "@/lib/fresh";
import { sql } from "@/lib/db";
import * as S from "@/lib/seed";
import { spendDateFrom } from "@/lib/dates";
import { contentHash } from "@/lib/agents/signals";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Hiring, not configuration. Every step here sets something the agent actually
 * reads at decision time: the policy it applies, the accounts it may post to,
 * the people it recognises, the limits it works inside. Nothing is cosmetic and
 * nothing is assumed. Until the last step runs, the agent has no work and no
 * authority to do any.
 */

export async function GET() {
  try {
    const c: any = await sql`select * from company where id = 1`;
    const counts: any = await sql`
      select
        (select count(*)::int from employees)      as employees,
        (select count(*)::int from gl_accounts)    as accounts,
        (select count(*)::int from cost_centers)   as centers,
        (select count(*)::int from policy_versions) as policies,
        (select count(*)::int from transactions)   as charges`;
    const a: any = await sql`select * from authority where id = 1`;

    // Everything already on file comes back too, so returning to a screen shows
    // what is saved rather than an empty box. A form that forgets what you gave
    // it reads as a form that discarded what you gave it.
    const pol: any = await sql`select version, body, note from policy_versions order by version desc limit 1`;
    const accounts: any = await sql`select code, name, type from gl_accounts order by code`;
    const centers: any = await sql`select code, name from cost_centers order by code`;
    const employees: any = await sql`
      select id, name, email, grade, department, cost_center, manager_name
      from employees order by id`;

    return fresh({
      ok: true, company: c[0] || null, counts: counts[0], authority: a[0] || null,
      onboarded: !!c[0]?.onboarded_at,
      current: {
        policy: pol[0] || null,
        accounts: accounts.map((r: any) => [r.code, r.name, r.type]),
        centers: centers.map((r: any) => [r.code, r.name]),
        employees: employees.map((r: any) => [r.id, r.name, r.email, r.grade, r.department, r.cost_center, r.manager_name]),
      },
      starterPolicy: S.POLICY_V1,
      standardAccounts: S.GL_ACCOUNTS,
      standardCenters: S.COST_CENTERS,
      sampleTeam: S.EMPLOYEES,
    });
  } catch (e: any) {
    return fresh({ ok: false, error: e.message, needsBootstrap: true });
  }
}

export async function POST(req: Request) {
  const { step, data } = await req.json();
  try {
    switch (step) {
      /* 1. Who the employer is. Currency and jurisdiction are not decoration:
            the closing step uses them to decide tax treatment. */
      case "company": {
        await sql`update company set
          name = ${data.name || null},
          legal_entity = ${data.legal_entity || null},
          home_currency = ${data.home_currency || "INR"},
          jurisdiction = ${data.jurisdiction || "India"},
          fiscal_year_start = ${data.fiscal_year_start || "April"},
          agent_name = ${data.agent_name || "the Controller"},
          reports_to = ${data.reports_to || "Corporate Controller"}
          where id = 1`;
        return ok();
      }

      /* 2. The policy. This is the whole of the law and it is read at decision
            time, so it can be changed later without touching anything else. */
      case "policy": {
        const cur: any = await sql`select coalesce(max(version),0) as v from policy_versions`;
        await sql`insert into policy_versions (version, body, note)
          values (${Number(cur[0].v) + 1}, ${data.body}, ${data.note || "Set during onboarding"})`;

        // The golden set is one person's reading of one policy. It only means
        // anything against the document it was written for, so it ships only
        // when that document is the one in use. Paste your own policy and the
        // Evaluation tab correctly reports that no answer key exists yet.
        const usingStarter = String(data.body || "").trim() === S.POLICY_V1.trim();
        const n: any = await sql`select count(*)::int as n from eval_cases`;
        if (usingStarter && !n[0].n) {
          for (const ev of S.EVAL_CASES) {
            await sql`insert into eval_cases (label,payload,expect_verdict,note)
              values (${ev[0]}, ${JSON.stringify(ev[1])}, ${ev[2]}, ${ev[3]})`;
          }
        } else if (!usingStarter) {
          await sql`delete from eval_cases`;
        }
        return ok();
      }

      /* 3. The books. The agent may only post to accounts that exist here, which
            is why a hallucinated account code is caught rather than posted. */
      case "books": {
        if (data.replace) {
          await sql`delete from gl_accounts`;
          await sql`delete from cost_centers`;
        }
        for (const g of data.accounts || []) {
          await sql`insert into gl_accounts (code,name,type,guidance)
            values (${g[0]},${g[1]},${g[2]},${g[3] || null})
            on conflict (code) do update set name = excluded.name, type = excluded.type`;
        }
        for (const c of data.centers || []) {
          await sql`insert into cost_centers (code,name) values (${c[0]},${c[1]})
            on conflict (code) do update set name = excluded.name`;
        }
        return ok();
      }

      /* 4. The people. Grade drives policy: several clauses turn on seniority. */
      case "people": {
        if (data.replace) await sql`delete from employees`;
        for (const e of data.employees || []) {
          await sql`insert into employees (id,name,email,grade,department,cost_center,manager_name,joined_on)
            values (${e[0]},${e[1]},${e[2]},${e[3]},${e[4]},${e[5]},${e[6] || null},${e[7] || null})
            on conflict (id) do update set name = excluded.name, grade = excluded.grade,
              department = excluded.department, cost_center = excluded.cost_center`;
        }
        return ok();
      }

      /* 5. Authority. Enforced in code after the model decides, so nothing written
            in a receipt can widen it. */
      case "authority": {
        await sql`update authority set
          auto_approve_limit = ${data.auto_approve_limit},
          auto_reject_limit  = ${data.auto_reject_limit},
          min_confidence     = ${data.min_confidence},
          escalate_risk_at   = ${data.escalate_risk_at},
          can_post_ledger    = ${data.can_post_ledger},
          can_reject         = ${data.can_reject},
          daily_spend_cap_usd = ${data.daily_spend_cap_usd ?? 5},
          updated_at = now() where id = 1`;
        return ok();
      }

      /* 6. Which rung to start on. Shadow is the honest default. */
      case "mode": {
        await sql`update authority set mode = ${data.mode}, paused = false, updated_at = now() where id = 1`;
        return ok();
      }

      /* 7. What work exists on day one. Empty is a legitimate answer: it just
            means the corroboration checks have less to work with, exactly as
            they would for a human controller on their first morning. */
      case "work": {
        if (data.load === "sample") await loadSampleMonth();
        return ok();
      }

      /* Nothing to save on this screen. Used when a value is already on file and
         was not edited, so continuing does not create a pointless new version. */
      case "noop":
        return ok();

      case "commit": {
        const gaps = await missingPieces();
        if (gaps.length) return fresh({ ok: false, error: `Still missing: ${gaps.join(", ")}.` });
        await sql`update company set onboarded_at = now() where id = 1`;
        return ok();
      }

      /* Wipes everything including the hire, so onboarding can be walked again. */
      case "reset": {
        await sql`truncate journal_lines, journal_entries, escalations, precedents, agent_runs,
          eval_runs, eval_cases, decision_log, guardrail_events, cases, transactions, receipts,
          calendar_events, trips, policy_versions restart identity cascade`;
        await sql`delete from employees`;
        await sql`delete from gl_accounts`;
        await sql`delete from cost_centers`;
        await sql`update company set onboarded_at = null, name = null, legal_entity = null,
          agent_name = 'the Controller' where id = 1`;
        await sql`update authority set mode = 'autonomous', paused = false, auto_approve_limit = 100000,
          auto_reject_limit = 5000, min_confidence = 0.80, escalate_risk_at = 'HIGH' where id = 1`;
        return ok();
      }
    }
    return fresh({ ok: false, error: "Unknown step." }, { status: 400 });
  } catch (e: any) {
    return fresh({ ok: false, error: e.message }, { status: 200 });
  }
}

async function ok() {
  const c: any = await sql`select * from company where id = 1`;
  const counts: any = await sql`
    select
      (select count(*)::int from employees)       as employees,
      (select count(*)::int from gl_accounts)     as accounts,
      (select count(*)::int from cost_centers)    as centers,
      (select count(*)::int from policy_versions) as policies,
      (select count(*)::int from transactions)    as charges`;
  return fresh({ ok: true, company: c[0], counts: counts[0], missing: await missingPieces() });
}

async function missingPieces() {
  const r: any = await sql`
    select
      (select count(*)::int from employees)       as employees,
      (select count(*)::int from gl_accounts)     as accounts,
      (select count(*)::int from cost_centers)    as centers,
      (select count(*)::int from policy_versions) as policies`;
  const c: any = await sql`select name from company where id = 1`;
  const gaps: string[] = [];
  if (!c[0]?.name) gaps.push("a company name");
  if (!r[0].policies) gaps.push("a policy");
  if (!r[0].accounts) gaps.push("a chart of accounts");
  if (!r[0].centers) gaps.push("at least one cost centre");
  if (!r[0].employees) gaps.push("at least one employee");
  return gaps;
}

/** The sample month. Eighteen charges, each labelled with what it puts under pressure. */
async function loadSampleMonth() {
  for (const t of S.TRIPS) {
    await sql`insert into trips (id,employee_id,purpose,origin,destination,starts_on,ends_on,approved_by,budget_inr)
      values (${t[0]},${t[1]},${t[2]},${t[3]},${t[4]},${t[5]},${t[6]},${t[7]},${t[8]}) on conflict do nothing`;
  }
  for (const c of S.CALENDAR) {
    await sql`insert into calendar_events (id,employee_id,title,starts_at,ends_at,location,attendees)
      values (${c[0]},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]},${c[6]}) on conflict do nothing`;
  }
  for (const r of S.RECEIPTS) {
    await sql`insert into receipts (id,employee_id,source,raw_text,content_hash,spend_date)
      values (${r[0]},${r[1]},${r[2]},${r[3]},${contentHash(r[3])},${spendDateFrom(r[3])})
      on conflict do nothing`;
  }
  for (const t of S.TRANSACTIONS) {
    await sql`insert into transactions (id,employee_id,merchant,mcc,amount,currency,amount_inr,txn_date,txn_time,card_last4,source,memo,scenario)
      values (${t[0]},${t[1]},${t[2]},${t[3]},${t[4]},${t[5]},${t[6]},${t[7]},${t[8]},${t[9]},${t[10]},${t[11]},${t[12] ?? null})
      on conflict do nothing`;
    await sql`insert into cases (id, transaction_id, status)
      values (${"CASE-" + t[0].slice(2)}, ${t[0]}, 'queued') on conflict do nothing`;
  }
}
