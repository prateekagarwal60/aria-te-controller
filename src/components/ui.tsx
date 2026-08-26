"use client";
import React from "react";

export const inr = (n: any) =>
  n == null || n === "" ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const usd = (n: any) => "$" + Number(n || 0).toFixed(4);

export function Stamp({ status, partial }: { status: string; partial?: boolean }) {
  /* A charge where part was disallowed did settle, but saying "settled and posted"
     beside the full amount reads as though the whole thing was paid. */
  if (partial && status === "settled") {
    return <span className="stamp stamp-escalated">Settled in part</span>;
  }
  const label: Record<string, string> = {
    settled: "Settled and posted",
    escalated: "Needs the Controller",
    rejected: "Disallowed",
    queued: "Not started",
    working: "Working",
    held: "Held",
  };
  const cls: Record<string, string> = {
    settled: "stamp-settled", escalated: "stamp-escalated",
    rejected: "stamp-rejected", queued: "stamp-queued", working: "stamp-queued", held: "stamp-escalated",
  };
  return <span className={`stamp ${cls[status] || "stamp-queued"}`}>{label[status] || status}</span>;
}

export function Chip({ tone = "slate", children }: { tone?: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    slate: "bg-paper2 text-graphite border-rule",
    green: "bg-[#E6F0EA] text-posted border-[#BBD8C9]",
    amber: "bg-[#F6EBD9] text-held border-[#E2CBA4]",
    red: "bg-[#F5E3E3] text-flagged border-[#E0BFBF]",
    blue: "bg-[#E4E9F6] text-stamp border-[#BFC9E6]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function riskTone(band?: string) {
  return band === "HIGH" ? "red" : band === "MEDIUM" ? "amber" : "green";
}
export function statusTone(s?: string) {
  return s === "settled" ? "green" : s === "escalated" ? "amber" : s === "rejected" ? "red" : "slate";
}

/* One name per step, used in the interface, in the work log, in the agent
   identifiers and in the documentation. Four call a model. Authorise does not. */
export const STEPS = [
  { key: "gather",      name: "Gather",      blurb: "Find the receipt, trip and diary" },
  { key: "corroborate", name: "Corroborate", blurb: "Check it against every charge" },
  { key: "decide",      name: "Decide",      blurb: "Apply your policy and rule" },
  { key: "authorise",   name: "Authorise",   blurb: "Is this hers to act on" },
  { key: "post",        name: "Post",        blurb: "Code it and post to the ledger" },
];

export function Pipeline({ state }: { state: Record<string, { s: string; ms?: number; read?: string; error?: string }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STEPS.map((st) => {
        const cur = state[st.key]?.s || "idle";
        const base = "relative overflow-hidden flex-1 min-w-[112px] border px-2.5 py-1.5 rounded-sm";
        const tone =
          cur === "done" ? "border-[#BBD8C9] bg-[#E6F0EA]"
          : cur === "run" ? "border-[#BFC9E6] bg-[#E4E9F6] running"
          : cur === "fail" ? "border-[#E0BFBF] bg-[#F5E3E3]"
          : cur === "skip" ? "border-rule bg-paper2 opacity-45"
          : "border-rule bg-paper2";
        return (
          <div key={st.key} className={`${base} ${tone}`}>
            <div className="text-[11px] font-semibold tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              {st.name}
            </div>
            <div className="text-[10px] text-graphite leading-tight">
              {cur === "fail" ? <span className="text-flagged">stopped here</span>
                : cur === "run" ? "working…"
                : cur === "done" ? (
                    <>
                      <span className="num">{state[st.key].ms}ms</span>
                      {state[st.key].read && <div className="truncate">{state[st.key].read}</div>}
                    </>
                  )
                : st.blurb}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Shows where a decision sat relative to the limit Aria was given. */
export function AuthorityBand({ amount, limit }: { amount: number; limit: number }) {
  const pct = Math.min(100, (amount / Math.max(limit, 1)) * 100);
  const over = amount > limit;
  return (
    <div>
      <div className="h-2.5 w-full bg-paper2 border border-rule rounded-sm overflow-hidden">
        <div className={`h-full ${over ? "bg-held" : "bg-posted"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-graphite num">
        <span>{inr(amount)}</span>
        <span>limit {inr(limit)}</span>
      </div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.14em] text-graphite font-semibold mb-1">{children}</div>
  );
}

export function Btn({
  children, onClick, tone = "ink", disabled, small, type,
}: any) {
  const map: Record<string, string> = {
    ink: "bg-ink text-paper hover:bg-ink2 border-ink",
    ghost: "bg-transparent text-ink hover:bg-paper2 border-rule",
    // For the dark header, where ghost renders near-black on navy.
    onDark: "bg-transparent text-paper border-paper/40 hover:bg-paper/10",
    onDarkSolid: "bg-paper text-ink border-paper hover:bg-white",
    green: "bg-posted text-white hover:opacity-90 border-posted",
    red: "bg-flagged text-white hover:opacity-90 border-flagged",
    amber: "bg-held text-white hover:opacity-90 border-held",
  };
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={`border rounded-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${small ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"} ${map[tone]}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full border border-rule bg-white px-2 py-1.5 text-[13px] rounded-sm placeholder:text-graphite/60";
