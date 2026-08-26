"use client";
import React, { useState } from "react";
import { Chip, Label, inr } from "./ui";
import { SIGNAL_MEANING, SIGNAL_GROUPS } from "@/lib/signalmeaning";

/**
 * What the agent was given, shown as the records themselves rather than as the
 * agent's description of them. A reviewer checking the work should not have to
 * trust the account of what was looked at, written by the thing being checked.
 *
 * Search windows are printed as the dates that were actually searched. "Fourteen
 * days either side" is not something anyone can verify; "5 Aug to 2 Sep, three
 * candidates, one matched" is.
 */
/* Reference prefixes: X- a card charge, CASE- the work item opened for it,
   R- a receipt, T- an approved trip, C- a diary entry, E- a person,
   JE- a journal entry. */
export default function EvidenceFile({ c, focus }: { c: any; focus?: string | null }) {
  const file = c.assembled?.file;
  if (!file) {
    return (
      <div className="text-[12.5px] text-graphite">
        Nothing gathered yet. Run the charge and everything it was given appears here.
      </div>
    );
  }
  const s = file.searched || {};
  const r = file.matched_receipt;

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-graphite">
        References: <span className="num">X-</span> a card charge, <span className="num">CASE-</span> the
        work item opened for it, <span className="num">R-</span> a receipt, <span className="num">T-</span> an
        approved trip, <span className="num">C-</span> a diary entry, <span className="num">JE-</span> a
        journal entry.
      </p>
      {/* The receipt, in full, on the page. Not behind a tab. */}
      <Section title="The receipt" open={focus === "evidence" || focus === "amt" || !focus}>
        {r ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[12px] text-graphite">{r.why}</span>
              <span className="num text-[11px] text-graphite">Receipt {r.id} · {r.source === "email" ? "forwarded by email" : r.source}</span>
            </div>
            <pre className="text-[11.5px] leading-relaxed whitespace-pre-wrap bg-paper2 border border-rule rounded-sm p-3 max-h-72 overflow-auto">
              {r.text}
            </pre>
            {(r.extracted?.internal_inconsistencies || []).length > 0 && (
              <ul className="text-[12px] text-flagged mt-2 space-y-0.5">
                {r.extracted.internal_inconsistencies.map((x: string, i: number) => <li key={i}>· {x}</li>)}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[12.5px]">
            <span className="font-semibold">None matched.</span>{" "}
            {c.adjudication?.evidence?.receipt_required
              ? "Your policy requires a receipt at this amount, so the charge was referred to you rather than settled."
              : "Your policy does not require a receipt at this amount, so the card record stands on its own."}
          </p>
        )}
      </Section>

      {/* Every candidate considered, and why the others were not it. */}
      <Section title={`Receipts searched · ${s.receipts?.window} · ${s.receipts?.found ?? 0} found`}
        open={focus === "evidence"}>
        {(s.receipts?.candidates || []).length === 0 ? (
          <p className="text-[12.5px] text-graphite">
            Nothing was filed by this employee in the {s.receipts?.days}-day window either side of the charge.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <tbody className="ruled">
              {s.receipts.candidates.map((x: any) => (
                <tr key={x.id} className={x.matched ? "bg-[#E6F0EA]" : ""}>
                  <td className="py-1 num w-20" title="Receipt reference">{x.id}</td>
                  <td className="py-1 text-graphite">{x.summary}</td>
                  <td className="py-1 num text-right w-24">{x.total != null ? inr(x.total) : ""}</td>
                  <td className="py-1 text-right w-20">
                    {x.matched ? <Chip tone="green">matched</Chip> : <span className="text-graphite text-[11px]">not this one</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Approved trips · ${s.trips?.window} · ${s.trips?.found ?? 0} found`} open={focus === "corr"}>
        {(s.trips?.entries || []).length === 0 ? (
          <p className="text-[12.5px] text-graphite">No approved trip covers this date.</p>
        ) : (
          s.trips.entries.map((t: any) => (
            <div key={t.id} className={`border rounded-sm px-2.5 py-2 mb-1.5 ${t.covers ? "border-[#BBD8C9] bg-[#E6F0EA]" : "border-rule bg-white/60"}`}>
              <div className="flex justify-between text-[12.5px]">
                <span className="font-semibold">{t.destination} · {t.purpose}</span>
                <span className="num text-graphite">Trip {t.id}</span>
              </div>
              <div className="text-[11.5px] text-graphite">
                {t.from} to {t.to} · approved by {t.approved_by} · budget {inr(t.budget_inr)}
                {t.covers ? " · covers this charge" : " · does not cover this date"}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title={`Calendar · ${s.calendar?.window} · ${s.calendar?.found ?? 0} found`} open={focus === "corr"}>
        {(s.calendar?.entries || []).length === 0 ? (
          <p className="text-[12.5px] text-graphite">
            Nothing in the diary within {s.calendar?.days} days either side.
          </p>
        ) : (
          s.calendar.entries.map((e: any) => (
            <div key={e.id} className="flex justify-between text-[12.5px] border-b border-rule py-1 last:border-0">
              <span>{e.title}{e.attendees ? ` · ${e.attendees} attending` : ""}</span>
              <span className="num text-graphite">
                {e.on}{e.sameDay ? " · same day" : ""}
              </span>
            </div>
          ))
        )}
      </Section>

      <Section title={`This merchant, elsewhere in the company · ${s.merchant_history?.found ?? 0} other charges`}
        open={focus === "risk"}>
        {(s.merchant_history?.entries || []).length === 0 ? (
          <p className="text-[12.5px] text-graphite">
            Nobody has charged this merchant before. On its own that means little; combined with other
            signals it is worth noting.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <tbody className="ruled">
              {s.merchant_history.entries.map((h: any) => (
                <tr key={h.id}>
                  <td className="py-1 num w-24">{h.on}</td>
                  <td className="py-1 num">{inr(h.amount_inr)}</td>
                  <td className="py-1 text-graphite text-right">{h.source === "employee_claim" ? "claim" : "card"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {(c.investigation?.machine_signals || []).length > 0 && (
        <Section title={`Corroboration checks · ${c.investigation.machine_signals.length} of 13 fired`} open={focus === "risk"}>
          {c.investigation.risk_explain && (
            <p className="text-[12px] text-graphite mb-2">
              Risk {String(c.investigation.risk_band).toLowerCase()}, scored{" "}
              <span className="num">{c.investigation.risk_explain}</span>. Each check that fires
              scores by how serious it is: 25 for a serious one, 10 for a moderate one, 3 for a weak
              one. Twenty five or more is high, ten or more is medium. It ranks a queue so the
              charges most worth your time come first; it is not a probability that anything is wrong.
            </p>
          )}
          <p className="text-[11.5px] text-graphite mb-2">
            These ask whether the spend happened as described, which is a different question from
            whether it is allowed. Each is a query across every charge in the company, not a look at
            this one.
          </p>
          <ul className="space-y-2">
            {c.investigation.machine_signals.map((sig: any, i: number) => {
              const m = SIGNAL_MEANING[sig.code];
              return (
                <li key={i} className="border-b border-rule pb-2 last:border-0">
                  <div className="flex gap-2 items-baseline">
                    <Chip tone={sig.severity === "high" ? "red" : sig.severity === "medium" ? "amber" : "slate"}>
                      {sig.code}
                    </Chip>
                    <span className="text-[12px]">{sig.detail}</span>
                  </div>
                  {m && (
                    <div className="text-[11.5px] text-graphite mt-1 pl-1">
                      <span className="italic">{m.asks}</span> {m.means}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [show, setShow] = useState(!!open);
  return (
    <div className="border border-rule rounded-sm bg-white/50">
      <button onClick={() => setShow(!show)} className="w-full text-left px-3 py-2 hover:bg-paper2/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.12em] text-graphite font-semibold">{title}</span>
          <span className="text-graphite text-[11px]">{show ? "hide" : "show"}</span>
        </div>
      </button>
      {show && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
