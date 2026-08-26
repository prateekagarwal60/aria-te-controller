"use client";
import React from "react";
import { inr } from "./ui";

/**
 * The point of this component is that nobody should have to read a workpaper to
 * trust a charge. Six checks, each computed here from the record rather than
 * taken from the agent's own account of itself, each green amber or grey. Scan
 * the row; read only what is amber.
 *
 * A Controller clearing forty charges a morning cannot audit forty pieces of
 * reasoning. They can scan forty rows of six.
 */

export type Check = {
  key: string;
  label: string;
  state: "ok" | "attention" | "none" | "pending";
  value: string;
  detail?: string;
};

export function buildChecks(c: any): Check[] {
  const a = c.assembled || {};
  const file = a.file || {};
  const inv = c.investigation || {};
  const adj = c.adjudication || {};
  const gate = c.authority || {};
  const close = c.closing || {};
  const worked = !!adj.verdict;

  const receipt = file.matched_receipt;
  const required = adj.evidence?.receipt_required;

  // 1. Evidence. Was a receipt required by THIS policy, and was one found.
  const evidence: Check = !worked
    ? { key: "evidence", label: "Receipt", state: "pending", value: "not run" }
    : receipt
    ? { key: "evidence", label: "Receipt", state: "ok", value: receipt.id,
        detail: adj.evidence?.note || "Matched to the charge." }
    : required
    ? { key: "evidence", label: "Receipt", state: "attention", value: "missing",
        detail: adj.evidence?.requirement_clause || "The policy requires one at this amount." }
    : { key: "evidence", label: "Receipt", state: "none", value: "not required",
        detail: adj.evidence?.note || "The policy does not require one at this amount." };

  // 2. Corroboration. Does anything the claimant does not control place this spend.
  const trip = (file.searched?.trips?.entries || []).find((t: any) => t.covers);
  const cal = (file.searched?.calendar?.entries || []).find((e: any) => e.sameDay);
  const independent = c.source === "card_feed";
  const corroboration: Check = !worked
    ? { key: "corr", label: "Corroboration", state: "pending", value: "not run" }
    : trip
    ? { key: "corr", label: "Corroboration", state: "ok", value: `trip ${trip.id}`,
        detail: `Inside approved trip ${trip.id} to ${trip.destination}, ${trip.from} to ${trip.to}.` }
    : cal
    ? { key: "corr", label: "Corroboration", state: "ok", value: `diary ${cal.id}`, detail: cal.title }
    : independent
    ? { key: "corr", label: "Corroboration", state: "none", value: "card record only",
        detail: "The card feed places the spend, but no trip or calendar entry explains it." }
    : { key: "corr", label: "Corroboration", state: "attention", value: "none",
        detail: "A claim with no independent record. The receipt is the only evidence the spend happened." };

  // 3. Do the numbers agree.
  const rt = receipt?.extracted?.total ?? null;
  const cardAmt = Number(c.amount);
  const agree = rt == null ? null : Math.abs(Number(rt) - cardAmt) <= Math.max(1, cardAmt * 0.01);
  const amounts: Check = !worked
    ? { key: "amt", label: "Amounts", state: "pending", value: "not run" }
    : rt == null
    ? { key: "amt", label: "Amounts", state: "none", value: "nothing to compare",
        detail: receipt ? "The receipt total could not be read." : "No receipt to compare against." }
    : agree
    ? { key: "amt", label: "Amounts", state: "ok", value: "agree",
        detail: `Receipt ${c.currency} ${rt} matches the charge.` }
    : { key: "amt", label: "Amounts", state: "attention", value: "differ",
        detail: `Receipt says ${rt}, the card says ${cardAmt}.` };

  // 4. Risk, from the corroboration signals rather than an opinion.
  const risk: Check = !worked
    ? { key: "risk", label: "Risk", state: "pending", value: "not run" }
    : inv.risk_band === "HIGH"
    ? { key: "risk", label: "Risk", state: "attention", value: `high, ${inv.risk_score}`,
        detail: `Scored ${inv.risk_explain || inv.risk_score}. ` +
          (inv.findings || []).filter((f: any) => f.severity === "high").map((f: any) => f.detail).join(" ") }
    : inv.risk_band === "MEDIUM"
    ? { key: "risk", label: "Risk", state: "attention", value: `medium, ${inv.risk_score}`,
        detail: `Scored ${inv.risk_explain || inv.risk_score}. ` +
          (inv.findings || []).filter((f: any) => f.severity !== "low").map((f: any) => f.detail).join(" ") }
    : { key: "risk", label: "Risk", state: "ok", value: `low, ${inv.risk_score ?? 0}`,
        detail: inv.risk_explain
          ? `Scored ${inv.risk_explain}. High counts 25, medium 10, low 3. Nothing of concern.`
          : `${(inv.machine_signals || []).length} checks run, nothing of concern.` };

  // 5. The policy call, and whether the clause it rests on is real.
  const cited = (adj.clauses || [])[0];
  const verified = adj.citations_verified !== false;
  const policy: Check = !worked
    ? { key: "pol", label: "Clause", state: "pending", value: "not run" }
    : !verified
    ? { key: "pol", label: "Clause", state: "attention", value: "not in the policy",
        detail: "A quoted clause does not appear in the policy document, so the decision was referred upward." }
    /* Amber means a human should look at this, not that money was withheld. A
       well founded refusal is a good outcome and used to count as a flag, which
       made every correctly disallowed charge look like a problem. What the check
       is about is whether the clause the decision rests on is real. */
    : { key: "pol", label: "Clause", state: "ok",
        value: adj.verdict === "APPROVE" ? "allowed"
             : adj.verdict === "PARTIAL" ? "allowed in part"
             : adj.verdict === "REJECT" ? "disallowed" : "referred up",
        detail: cited ? `“${String(cited.quote).slice(0, 120)}”` : adj.reasoning };

  // 6. What happened to the money.
  const posted: Check = !worked
    ? { key: "post", label: "Posted", state: "pending", value: "not run" }
    : close.entry_ref && close.balanced
    ? { key: "post", label: "Posted", state: "ok", value: close.entry_ref,
        detail: `${inr(close.totals?.debit)} in balance.` }
    : c.status === "escalated"
    ? { key: "post", label: "Posted", state: "attention", value: "waiting on you",
        detail: (gate.reasons || [])[0] || "Referred upward." }
    : c.status === "rejected"
    ? { key: "post", label: "Posted", state: "none", value: "nothing to post",
        detail: "The charge was disallowed." }
    : { key: "post", label: "Posted", state: "attention", value: "not posted" };

  return [evidence, corroboration, amounts, risk, policy, posted];
}

const TONE: Record<string, string> = {
  ok: "border-[#BBD8C9] bg-[#E6F0EA] text-posted",
  attention: "border-[#E2CBA4] bg-[#F6EBD9] text-held",
  none: "border-rule bg-paper2 text-graphite",
  pending: "border-rule bg-paper2 text-graphite/60",
};
const MARK: Record<string, string> = { ok: "✓", attention: "!", none: "–", pending: "·" };

export default function TrustStrip({ checks, onPick }: { checks: Check[]; onPick?: (k: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
      {checks.map((c) => (
        <button key={c.key} onClick={() => onPick?.(c.key)} title={c.detail || ""}
          className={`text-left border rounded-sm px-2 py-1.5 transition-colors hover:brightness-95 ${TONE[c.state]}`}>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[12px] leading-none">{MARK[c.state]}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] font-semibold">{c.label}</span>
          </div>
          <div className="text-[11.5px] mt-0.5 truncate">{c.value}</div>
        </button>
      ))}
    </div>
  );
}

/** One-line summary for a queue row: how many need a look. */
export function trustSummary(checks: Check[]) {
  const attention = checks.filter((c) => c.state === "attention");
  const pending = checks.filter((c) => c.state === "pending").length;
  if (pending === checks.length) return { tone: "slate", text: "not run" };
  if (!attention.length) return { tone: "green", text: "all six clear" };
  return { tone: "amber", text: `${attention.length} to look at: ${attention.map((a) => a.label.toLowerCase()).join(", ")}` };
}
