"use client";
import React, { useState } from "react";
import { Stamp, Chip, inr, Label, AuthorityBand, riskTone, Btn } from "./ui";
import TrustStrip, { buildChecks } from "./TrustStrip";
import EvidenceFile from "./EvidenceFile";

/**
 * Two audiences, two densities. Someone clearing a queue wants the verdict, the
 * amount, one line of reasoning and the clause. Someone checking the work wants
 * all of it. Brief is the default because most of the time nobody is auditing.
 */
export default function Workpaper({ c, onReviewed }: { c: any; onReviewed?: () => void }) {
  const [full, setFull] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const checks = buildChecks(c);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  /* A charge that came to you and that you ruled on is not one she settled on her
     own, so there is nothing to spot check: you already made the decision. */
  const settledHerself = (c.status === "settled" || c.status === "rejected") && !c.decided_by_you;

  const [reviewError, setReviewError] = useState<string | null>(null);

  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const review = async (agreed: boolean) => {
    /* The buttons used to sit still until the server came back, so pressing one
       felt like nothing had happened. */
    setOptimistic(agreed);
    setReviewing(true); setReviewError(null);
    // The reply used to be discarded, so a failure looked exactly like a button
    // that did nothing.
    const r = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId: c.id, agreed, note: agreed ? null : reviewNote }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Could not reach the server." }));
    setReviewing(false);
    if (!r.ok) { setOptimistic(null); setReviewError(r.error || "That did not save."); return; }
    setReviewNote("");
    onReviewed?.();
  };
  const attention = checks.filter((x) => x.state === "attention");
  const a = c.assembled || {};
  const inv = c.investigation || {};
  const adj = c.adjudication || {};
  const gate = c.authority || {};
  const close = c.closing || {};

  return (
    <div className="paper p-6 rise">
      {/* Masthead */}
      <div className="flex items-start justify-between gap-6 pb-4 border-b border-rule">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-graphite font-semibold">
            Expense workpaper
          </div>
          <h2 className="mt-1 text-2xl leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {c.merchant}
          </h2>
          <div className="mt-1 text-[12px] text-graphite">
            {c.employee_name} · {c.grade} · {c.cost_center} · {String(c.txn_date).slice(0, 10)}
            {c.txn_time ? ` at ${c.txn_time}` : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>Case {c.case_id || c.id}</Chip>
            <Chip>{c.source === "employee_claim" ? "Reimbursement claim" : `Card ····${c.card_last4 || "—"}`}</Chip>
            {c.policy_version && <Chip tone="blue">Policy v{c.policy_version}</Chip>}
            {inv.risk_band && <Chip tone={riskTone(inv.risk_band)}>Risk {inv.risk_band} · {inv.risk_score}</Chip>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <button onClick={() => setFull(!full)}
            className="text-[10px] uppercase tracking-[0.14em] text-graphite hover:text-ink mb-2 border border-rule rounded-sm px-2 py-0.5">
            {full ? "Brief" : "Show the working"}
          </button>
          <div />
          {(() => {
            const charged = Number(c.amount_inr);
            const allowed = c.amount_allowed == null ? null : Number(c.amount_allowed);
            const partial = allowed != null && allowed > 0.01 && allowed < charged - 0.01;
            return (
              <>
                <div className="num text-3xl" style={{ fontWeight: 600 }}>
                  {inr(partial ? allowed : charged)}
                </div>
                {partial && (
                  <div className="text-[12px] text-graphite mt-0.5">
                    allowed of <span className="num">{inr(charged)}</span> charged
                    <div className="num text-flagged">{inr(charged - allowed)} disallowed</div>
                  </div>
                )}
                {!partial && c.currency !== "INR" && (
                  <div className="num text-[12px] text-graphite">{c.currency} {Number(c.amount).toLocaleString()}</div>
                )}
                <div className="mt-3"><Stamp status={c.status} partial={partial} /></div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="py-4 border-b border-rule">
        <TrustStrip checks={checks} onPick={(k) => { setFocus(k); setFull(true); }} />
        {c.adjudication?.verdict && (
          <p className="text-[13px] mt-3 leading-relaxed">
            {attention.length === 0
              ? <><span className="font-semibold text-posted">Nothing needs you. </span>{c.adjudication.reasoning}</>
              : <><span className="font-semibold text-held">{attention.length} thing{attention.length === 1 ? "" : "s"} to look at. </span>{attention.map((a) => a.detail).filter(Boolean)[0]}</>}
          </p>
        )}
      </div>

      {/* What the agent was given, as the records themselves. */}
      <div className="py-4 border-b border-rule">
        <div className="flex items-baseline justify-between mb-2">
          <Label>What it was given</Label>
          <button onClick={() => setFull(!full)} className="text-[11px] text-stamp hover:underline">
            {full ? "Collapse" : "Open the evidence file"}
          </button>
        </div>
        {full
          ? <EvidenceFile c={c} focus={focus} />
          : <p className="text-[12.5px] text-graphite">
              {c.assembled?.file
                ? `${c.assembled.file.searched?.receipts?.found ?? 0} receipts in the window, ${c.assembled.file.searched?.trips?.found ?? 0} approved trip(s), ${c.assembled.file.searched?.calendar?.found ?? 0} calendar entries, ${c.assembled.file.searched?.merchant_history?.found ?? 0} other charges at this merchant. Open it to see every record with its dates.`
                : "Not gathered yet."}
            </p>}
      </div>

      {c.scenario && full && (
        <div className="py-3 border-b border-rule">
          <Label>About this charge</Label>
          <p className="text-[12.5px] text-graphite italic">{c.scenario}</p>
        </div>
      )}

      {/* Narrative */}
      {a.narrative && full && (
        <div className="py-4 border-b border-rule">
          <Label>What appears to have happened</Label>
          <p className="text-[13.5px] leading-relaxed">{a.narrative}</p>
          {a.category && <div className="mt-2"><Chip>{a.category}</Chip></div>}
        </div>
      )}

      {/* Adjudication */}
      {adj.verdict && (
        <div className="py-4 border-b border-rule">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <Label>Decision</Label>
            <div className="text-[11px] text-graphite num">
              {adj.precedents_considered
                ? `${adj.precedents_considered} past ruling${adj.precedents_considered === 1 ? "" : "s"} considered`
                : ""}
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed">{adj.reasoning}</p>

          {(adj.clauses || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(full ? adj.clauses : adj.clauses.slice(0, 1)).map((cl: any, i: number) => (
                <blockquote key={i} className="border-l-2 border-stamp/50 pl-3">
                  <div className="text-[12.5px] italic">“{cl.quote}”</div>
                  <div className="text-[11.5px] text-graphite mt-0.5">{cl.applies_because}</div>
                </blockquote>
              ))}
              {!full && adj.clauses.length > 1 && (
                <div className="text-[11.5px] text-graphite">and {adj.clauses.length - 1} more clause(s)</div>
              )}
            </div>
          )}

          {adj.precedent_used && (
            <div className="mt-3 border border-[#BFC9E6] bg-[#E4E9F6] rounded-sm px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-stamp font-semibold mb-0.5">
                Followed a Controller ruling
              </div>
              <div className="text-[12.5px]">{adj.precedent_used}</div>
            </div>
          )}

          {(adj.amount_disallowed > 0) && (
            <div className="mt-3 text-[12.5px]">
              Allowed <span className="num font-semibold">{inr(adj.amount_allowed)}</span>,
              disallowed <span className="num font-semibold text-flagged">{inr(adj.amount_disallowed)}</span>.
            </div>
          )}
          {!adj.note_to_employee && Number(adj.amount_disallowed || 0) > 0.01 && (
            <div className="mt-3 border border-[#E2CBA4] bg-[#F6EBD9] rounded-sm px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-held font-semibold">
                Nothing drafted for {String(c.employee_name).split(" ")[0]}
              </div>
              <p className="text-[12.5px] text-graphite mt-1">
                {inr(adj.amount_disallowed)} was not reimbursed and no message was written. They will see a
                short payment without knowing why, so this is worth writing yourself.
              </p>
            </div>
          )}
          {!adj.note_to_employee && Number(adj.amount_disallowed || 0) <= 0.01 && c.status === "settled" && (
            <div className="mt-3 text-[12px] text-graphite">
              Nothing to tell {String(c.employee_name).split(" ")[0]}. The charge was covered in full.
            </div>
          )}
          {adj.note_to_employee && (
            <div className="mt-3 border border-rule bg-white/60 rounded-sm px-2.5 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.12em] text-graphite font-semibold">
                  Draft message to {String(c.employee_name).split(" ")[0]}
                </span>
                <Chip>not sent</Chip>
              </div>
              <p className="text-[12.5px] text-graphite mt-1">{adj.note_to_employee}</p>
              <p className="text-[11.5px] text-graphite mt-1.5 italic">
                {c.status === "escalated"
                  ? "Drafted before you ruled, so it may not match your decision. Nothing is sent until you say so."
                  : "Nothing is sent from here. Send it, edit it, or discard it."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Authority */}
      {gate.limits && full && (
        <div className="py-4 border-b border-rule">
          <Label>Was this hers to decide</Label>
          <div className="max-w-sm"><AuthorityBand amount={Number(c.amount_allowed ?? c.amount_inr)} limit={gate.limits.auto_approve_limit} /></div>
          {gate.acted ? (
            <p className="mt-2 text-[12.5px] text-posted">
              Inside Aria&rsquo;s authority. She acted without asking.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {(gate.reasons || []).map((r: string, i: number) => (
                <li key={i} className="text-[12.5px] text-held">· {r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!full && gate.limits && !gate.acted && (
        <div className="py-3 border-b border-rule">
          <p className="text-[12.5px] text-held">{(gate.reasons || [])[0]}</p>
        </div>
      )}

      {/* Journal entry */}
      {(close.lines || []).length > 0 && (
        <div className="py-4 border-b border-rule">
          <div className="flex items-baseline justify-between">
            <Label>Journal entry</Label>
            {close.entry_ref && <span className="num text-[11px] text-graphite">{close.entry_ref}</span>}
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-graphite text-[10px] uppercase tracking-[0.12em]">
                <th className="text-left font-semibold py-1">Account</th>
                <th className="text-left font-semibold py-1">Cost centre</th>
                <th className="text-right font-semibold py-1">Debit</th>
                <th className="text-right font-semibold py-1">Credit</th>
              </tr>
            </thead>
            <tbody className="ruled">
              {close.lines.map((l: any, i: number) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2">
                    <span className="num">{l.account_code}</span>
                    <div className="text-graphite text-[11.5px]">{l.memo}</div>
                  </td>
                  <td className="py-1.5 num text-graphite">{l.cost_center}</td>
                  <td className="py-1.5 num text-right">{l.debit ? inr(l.debit) : ""}</td>
                  <td className="py-1.5 num text-right">{l.credit ? inr(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="double-rule">
                <td colSpan={2} className="py-1.5 text-[11px] uppercase tracking-[0.12em] text-graphite font-semibold">
                  {close.balanced ? "Balanced" : "Out of balance, not posted"}
                </td>
                <td className="py-1.5 num text-right font-semibold">{inr(close.totals?.debit)}</td>
                <td className="py-1.5 num text-right font-semibold">{inr(close.totals?.credit)}</td>
              </tr>
            </tfoot>
          </table>
          {close.tax_treatment && (
            <p className="mt-2 text-[12px] text-graphite">{close.tax_treatment}</p>
          )}
        </div>
      )}

      {/* Spot check. The touchless figure means nothing if nobody can test it. */}
      {settledHerself && (
        <div className="py-4 border-t border-rule">
          {c.reviewed_at || optimistic !== null ? (
            <div className="flex items-baseline gap-2">
              <Chip tone={(c.reviewed_at ? c.review_agreed : optimistic) ? "green" : "amber"}>
                {(c.reviewed_at ? c.review_agreed : optimistic) ? "You agreed" : "You disagreed"}
              </Chip>
              {c.review_note && <span className="text-[12px] text-graphite">{c.review_note}</span>}
            </div>
          ) : (
            <>
              <Label>She decided this without you</Label>
              <p className="text-[12.5px] text-graphite mb-2">Would you have called it the same way?</p>
              {reviewError && (
                <p className="text-[12.5px] text-flagged mb-2">{reviewError}</p>
              )}
              <div className="flex gap-2 items-start">
                <Btn tone="green" small disabled={reviewing} onClick={() => review(true)}>
                  I would have decided the same
                </Btn>
                <Btn tone="amber" small disabled={reviewing || !reviewNote.trim()} onClick={() => review(false)}>
                  I would not
                </Btn>
                <input
                  className="flex-1 border border-rule bg-white px-2 py-1 text-[12px] rounded-sm"
                  placeholder="If not, what should have happened?"
                  value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
