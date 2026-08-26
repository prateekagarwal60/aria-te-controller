import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const entries: any = await sql`
    select je.id, je.entry_ref, je.posted_at, je.case_id, t.merchant, e.name as employee_name
    from journal_entries je
    join cases c on c.id = je.case_id
    join transactions t on t.id = c.transaction_id
    join employees e on e.id = t.employee_id
    order by je.posted_at desc`;
  const lines: any = await sql`
    select jl.*, ga.name as account_name, ga.type as account_type
    from journal_lines jl left join gl_accounts ga on ga.code = jl.account_code
    order by jl.entry_id, jl.id`;
  const tb: any = await sql`
    select jl.account_code, ga.name as account_name, ga.type,
           coalesce(sum(jl.debit),0) as debit, coalesce(sum(jl.credit),0) as credit
    from journal_lines jl left join gl_accounts ga on ga.code = jl.account_code
    group by jl.account_code, ga.name, ga.type order by jl.account_code`;
  const totals: any = await sql`
    select coalesce(sum(debit),0) as debit, coalesce(sum(credit),0) as credit from journal_lines`;
  return NextResponse.json({ ok: true, entries, lines, trialBalance: tb, totals: totals[0] });
}
