"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Workpaper from "@/components/Workpaper";
import Onboarding from "@/components/Onboarding";
import Trace from "@/components/Trace";
import Agents from "@/components/Agents";
import { buildChecks, trustSummary } from "@/components/TrustStrip";
import {
  Stamp, Chip, inr, Label, Btn, Field, inputCls, Pipeline, STEPS, statusTone, riskTone,
} from "@/components/ui";

/* The work you do every day. Authority, Controls and Evaluation were peers of
   these and are not: they are things you set once and revisit, so they sit
   together behind Settings. Their view keys are unchanged, so anything that
   linked to one still resolves. */
const VIEWS = [
  ["desk", "Queue"],
  ["escalations", "Escalations"],
  ["ledger", "Ledger"],
  ["precedents", "Precedents"],
  ["intake", "Manual entry"],
  ["settings", "Settings"],
] as const;

const SETTINGS_SECTIONS = [
  ["policy", "The policy she applies", "The document she reads at the moment she decides."],
  ["terms", "What she may do", "The limits she works inside, enforced after she decides."],
  ["governance", "How she is running", "Which rung she is on, her stop button, and what has been recorded."],
  ["evals", "How she is checked", "Score her against decisions you have already made."],
] as const;

/* Agents is for whoever owns the product, not for a Controller, so it is not on
   the nav. Type "agents" anywhere outside a text field to show or hide it, or add
   ?dev=1 to the URL. It survives navigation within the session and is gone on a
   fresh load. */
const DEV_VIEWS = [["agents", "Agents"]] as const;

/* How long a person takes to review and code one charge. An assumption, not a
   measurement, so it is printed next to the figure it produces. */
const MINUTES_A_CHARGE = 6;

/* Charges are independent, so there is no reason to work them one at a time. The
   five steps within a charge stay in order because each needs the last. Four at
   once takes a queue of eighteen from roughly fifteen minutes to about four. */
const AT_ONCE = 4;

export default function Console() {
  const [state, setState] = useState<any>(null);
  const [view, setView] = useState<string>("desk");
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [pipe, setPipe] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [pane, setPane] = useState<"workpaper" | "trace">("workpaper");
  const [stopped, setStopped] = useState<any>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [working, setWorking] = useState<string[]>([]);
  const [dev, setDev] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("dev") === "1") setDev(true);
    else if (sessionStorage.getItem("aria.dev") === "1") setDev(true);
    let typed = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && /input|textarea|select/i.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      typed = (typed + e.key).slice(-6);
      if (typed.endsWith("agents")) {
        setDev((d) => {
          const next = !d;
          sessionStorage.setItem("aria.dev", next ? "1" : "0");
          return next;
        });
        typed = "";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const stopRef = useRef(false);
  const bootstrapping = useRef<Promise<any> | null>(null);
  const attempts = useRef(0);

  const load = async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    const r = await res.json();
    if (!r.ok && r.needsBootstrap) {
      /* React runs effects twice in development, so two of these arrive at once.
         A boolean flag made the second one report failure before the first had
         finished preparing anything. They share one request instead, and the
         reply is read rather than assumed. */
      if (attempts.current >= 2) {
        setStopped({ caseId: "", step: "startup",
          error: r.error || "The database could not be prepared." });
        return;
      }
      attempts.current += 1;
      if (!bootstrapping.current) {
        bootstrapping.current = fetch("/api/bootstrap", { method: "POST" })
          .then((x) => x.json())
          .catch((e) => ({ ok: false, error: String(e?.message || e) }));
      }
      const b = await bootstrapping.current;
      bootstrapping.current = null;
      if (b && b.ok === false) {
        setStopped({ caseId: "", step: "startup", error: b.error });
        return;
      }
      return load();
    }
    setState(r);
    return r;
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {}); }, []);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  /* ---- run one case through the pipeline, one agent at a time ---- */
  const runCase = async (caseId: string, silent = false, refresh = true) => {
    void silent;
    if (refresh) setStopped(null);
    let step: string | null = "gather";
    const local: Record<string, any> = {};
    while (step) {
      local[step] = { s: "run" };
      setPipe({ ...local, caseId } as any);
      const t0 = Date.now();
      const r = await fetch("/api/step", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, step }),
      }).then((x) => x.json());
      if (!r.ok) {
        local[step] = { s: "fail", error: r.error };
        setPipe({ ...local, caseId } as any);
        setStopped({ caseId, step, error: r.error || "No reason was given." });
        break;
      }
      local[step] = { s: "done", ms: Date.now() - t0, read: r.read };
      setPipe({ ...local, caseId } as any);
      step = r.next;
      if (stopRef.current) break;
    }
    /* Reloading after every charge would fire four requests a second for the same
       data. The row is patched from what the step already returned instead, so a
       charge changes on screen the moment it finishes rather than at the end. */
    if (refresh) await load();
  };

  /* Charges are independent of each other, so there is no reason to work them one
     at a time. The five steps within a charge stay in order because each one needs
     the last. Four at once takes a queue of eighteen from roughly fifteen minutes
     to about four, which is the difference between a demo you can talk over and
     one you have to apologise for. */
  const runQueue = async () => {
    stopRef.current = false;
    setBusy(true); setStopped(null);
    const queued = (state?.cases || []).filter((c: any) => c.status === "queued");
    setProgress({ done: 0, total: queued.length });

    let next = 0, done = 0;
    const worker = async () => {
      while (!stopRef.current) {
        const i = next++;
        if (i >= queued.length) return;
        const id = queued[i].id;
        setWorking((w) => [...w, id]);
        await runCase(id, true, false);
        setWorking((w) => w.filter((x) => x !== id));

        /* Reload the whole state when a charge finishes.
         *
         * This was once a local patch of the row's status alone, to avoid what I
         * thought would be four requests a second. Four workers each taking about
         * forty five seconds is one completion every eleven, so there was no
         * problem to avoid. And patching only the status made a row read as
         * settled while the workpaper beside it had no decision to draw, because
         * the adjudication, the evidence and the entry were never patched. */
        await load();
        done += 1;
        setProgress({ done, total: queued.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queued.length) }, worker));

    setBusy(false); setProgress(null); setWorking([]);
    await load();
    say(stopRef.current ? "Stopped." : `${done} charges worked.`);
  };

  const openWorkpaper = (id: string) => setOpenCase(id);

  useEffect(() => { if (!dev && view === "agents") setView("desk"); }, [dev, view]);

  const cases = state?.cases || [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { queued: 0, settled: 0, escalated: 0, rejected: 0, working: 0 };
    cases.forEach((x: any) => { c[x.status] = (c[x.status] || 0) + 1; });
    return c;
  }, [cases]);

  const touchless = cases.length
    ? Math.round(((counts.settled + counts.rejected) / cases.length) * 100) : 0;
  const worked = counts.settled + counts.rejected + counts.escalated;

  /* What she saved, not what she cost. Money she stopped is measured, not
     assumed: it is the difference between what was charged and what she allowed
     on every charge she settled herself. Time is an assumption and is labelled
     as one on the screen. */
  const stopped_spend = cases.reduce((sum: number, c: any) => {
    if (c.status !== "settled" && c.status !== "rejected") return sum;
    const charged = Number(c.amount_inr || 0);
    const allowed = c.status === "rejected" ? 0 : Number(c.amount_allowed ?? charged);
    return sum + Math.max(0, charged - allowed);
  }, 0);
  const waiting_value = cases.reduce((sum: number, c: any) =>
    c.status === "escalated" ? sum + Number(c.amount_inr || 0) : sum, 0);

  /* One number, about one thing: have you tested what she settled on her own.
     It used to add together answering a question she could not settle, changing
     a view she had reached, and disagreeing with something she settled, which
     are three different events and made the figure unreadable. */
  const settledAlone = cases.filter((c: any) =>
    (c.status === "settled" || c.status === "rejected") && !c.decided_by_you);
  const spotChecked = settledAlone.filter((c: any) => c.reviewed_at).length;
  const spotDisagreed = settledAlone.filter((c: any) => c.reviewed_at && c.review_agreed === false).length;
  const precision = settledAlone.length === 0
    ? { label: "none yet", note: "she has not settled anything on her own" }
    : { label: `${spotChecked} of ${settledAlone.length}`,
        note: spotChecked === 0 ? "open one she settled and say if you agree"
            : spotDisagreed === 0 ? `you agreed with all ${spotChecked}`
            : `you disagreed with ${spotDisagreed}` };

  const minutes = (counts.settled + counts.rejected) * MINUTES_A_CHARGE;
  const hoursBack = minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} hrs`;
  const current = cases.find((c: any) => c.id === openCase);

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center text-paper">
        <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">Opening the books</div>
      </div>
    );
  }

  if (state.onboarded === false) {
    return <Onboarding onDone={() => { setState(null); load(); }} />;
  }

  const agent = state.company?.agent_name && state.company.agent_name !== "the Controller"
    ? state.company.agent_name : "The Controller";

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------------- header: the employee, not the software ---------------- */}
      <header className="bg-ink text-paper border-b border-ink3">
        <div className="px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-paper text-ink grid place-items-center font-bold"
                 style={{ fontFamily: "var(--font-display)" }}>{agent.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="text-[17px] leading-none" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                {agent}
              </div>
              <div className="text-[11px] opacity-65 mt-0.5">
                Travel and Expense Controller at {state.company?.name || "your company"} · reports to the {state.company?.reports_to || "Corporate Controller"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
            <Stat label="Worked" value={`${worked}/${cases.length}`} />
            <Stat label="Settled without you" value={`${touchless}%`} />
            <Stat label="Waiting on you" value={String(counts.escalated)}
              note={counts.escalated ? `${inr(waiting_value)} at stake` : undefined} />
            <Stat label="Spend she stopped" value={inr(stopped_spend)} />
            <Stat label="Checked by you" value={precision.label} note={precision.note} />
            <Stat label="Your time back" value={hoursBack} note={`at ${MINUTES_A_CHARGE} minutes a charge`} />
          </div>

          {state.governance?.state?.paused && (
            <div className="w-full order-last bg-flagged text-white px-3 py-1.5 rounded-sm text-[12px]">
              Stopped. Nothing new will be picked up until a Controller restarts her under Controls.
            </div>
          )}
          {state.governance?.state?.mode && state.governance.state.mode !== "autonomous" && (
            <Chip tone="amber">{state.governance.state.mode} mode</Chip>
          )}

          <div className="ml-auto flex gap-2">
            {busy
              ? <Btn tone="onDark" onClick={() => { stopRef.current = true; }}>Stop</Btn>
              : <Btn tone="onDarkSolid" onClick={runQueue} disabled={!counts.queued}>
                  Work the queue{counts.queued ? ` (${counts.queued})` : ""}
                </Btn>}
            <Btn tone="onDark" onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}>Sign out</Btn>
          </div>
        </div>

        <nav className="px-5 flex gap-1 overflow-x-auto">
          {[...VIEWS, ...(dev ? DEV_VIEWS : [])].map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-2 text-[12.5px] border-b-2 whitespace-nowrap transition-colors
                ${view === k ? "border-paper text-paper" : "border-transparent text-paper/55 hover:text-paper/85"}`}>
              {label}
              {k === "escalations" && counts.escalated > 0 && (
                <span className="ml-1.5 num text-[10px] bg-held text-white px-1 rounded-sm">{counts.escalated}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {state.governance?.state && (() => {
        const g = state.governance.state;
        const near = Number(g.spentToday) > Number(g.cap) * 0.8;
        if (!near) return null;
        return (
          <div className={`px-5 py-2 text-[12.5px] ${g.capReached ? "bg-flagged text-white" : "bg-held text-white"}`}>
            {g.capReached
              ? "She has reached her daily running budget and has stopped. Raise it under Controls, or wait until tomorrow."
              : "She is close to her daily running budget. Raise it under Controls if you want her to keep going."}
          </div>
        );
      })()}

      {stopped && (
        <div className="bg-flagged text-white px-5 py-2.5 text-[12.5px] flex items-start gap-3">
          <div className="flex-1">
            <span className="font-semibold">She stopped at {stopped.step}. </span>
            {stopped.error}
            {/^Daily (spend|cost) cap/i.test(stopped.error) && (
              <span> Raise it under Controls, or wait until tomorrow.</span>
            )}
            {/paused/i.test(stopped.error) && <span> Restart her under Controls.</span>}
            <span className="opacity-75 num"> · {stopped.caseId}</span>
          </div>
          <button onClick={() => setStopped(null)} className="opacity-75 hover:opacity-100">dismiss</button>
        </div>
      )}

      {health && !health.ok && (
        <div className="bg-flagged text-white px-5 py-2.5 text-[12.5px]">
          <span className="font-semibold">Aria cannot work yet. </span>
          {health.checks.filter((c: any) => !c.ok).map((c: any, i: number) => (
            <span key={i}>{c.name}: {c.detail}{c.hint ? ` — ${c.hint}` : ""}. </span>
          ))}
        </div>
      )}

      <main className="flex-1 bg-ink2/95 p-5">
        {view === "desk" && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5">
            <section>
              <PaneTitle>Work queue</PaneTitle>
              {progress ? (
                <div className="paper p-3 mb-3">
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span>Working {AT_ONCE} at a time</span>
                    <span className="num">{progress.done} of {progress.total}</span>
                  </div>
                  <div className="h-2 bg-paper2 border border-rule rounded-sm overflow-hidden">
                    <div className="h-full bg-posted transition-all"
                      style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                  </div>
                </div>
              ) : pipe.caseId ? (
                <div className="paper p-3 mb-3">
                  <div className="text-[11px] text-graphite mb-2 num">{pipe.caseId}</div>
                  <Pipeline state={pipe} />
                </div>
              ) : null}

              {(() => {
                /* Two facts, which is all anyone needs before the list itself:
                   how many need me, and can I leave the rest alone. Everything
                   else about a charge is on its own row and its own workpaper,
                   and stacking three paragraphs of it here read as noise. */
                const own = cases.filter((x: any) => x.status === "settled" || x.status === "rejected");
                const checked = own.filter((x: any) => x.reviewed_at).length;
                const disagreed = own.filter((x: any) => x.reviewed_at && x.review_agreed === false).length;
                const sound = own.filter((x: any) =>
                  x.adjudication?.citations_verified !== false &&
                  (x.status === "rejected" || x.closing?.balanced)).length;

                if (!cases.length) return (
                  <div className="paper p-3 mb-3 text-[12.5px]">
                    Nothing on the queue. Add one under
                    <span className="font-semibold"> Manual entry</span>, or connect your card feed.
                  </div>
                );
                if (!own.length) return (
                  <div className="paper p-3 mb-3 text-[12.5px]">
                    {counts.queued} charges waiting. Click a row to read one first.
                  </div>
                );
                return (
                  <div className="paper p-3 mb-3">
                    <p className="text-[13px]">
                      <span className="font-semibold">{own.length} settled without you</span>
                      {counts.escalated > 0 && <>, {counts.escalated} need you</>}
                      {counts.queued > 0 && <>, {counts.queued} still to run</>}.
                      {counts.queued === 0 && (
                        <> All {cases.length} read in full, where a person reviewing by hand would sample a tenth.</>
                      )}
                    </p>
                    <p className="text-[12px] text-graphite mt-1">
                      {sound === own.length
                        ? "Each quotes a clause and balances."
                        : `${sound} of ${own.length} quote a clause and balance.`}
                      {" "}
                      {checked === 0 ? "Open one to check her."
                        : disagreed === 0 ? `You checked ${checked}, agreed with all.`
                        : `You checked ${checked}, disagreed with ${disagreed}.`}
                    </p>
                  </div>
                );
              })()}

              <div className="paper overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-paper2">
                    <tr className="text-graphite text-[10px] uppercase tracking-[0.12em]">
                      <th className="text-left font-semibold px-3 py-2">Charge</th>
                      <th className="text-right font-semibold px-2 py-2">Amount</th>
                      <th className="text-left font-semibold px-2 py-2">Status</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="ruled">
                    {cases.map((c: any) => (
                      <tr key={c.id}
                          onClick={() => openWorkpaper(c.id)}
                          className={`cursor-pointer hover:bg-paper2/70 transition-colors
                            ${openCase === c.id ? "bg-[#E4E9F6]" : working.includes(c.id) ? "bg-[#FBF3E3]" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="font-semibold flex items-center gap-2">
                            {c.merchant}
                            {working.includes(c.id) && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]
                                               text-held font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-held animate-pulse" />
                                working
                              </span>
                            )}
                          </div>
                          <div className="text-graphite text-[11.5px]">
                            {c.employee_name} · {String(c.txn_date).slice(0, 10)}
                            {c.source === "employee_claim" && " · reimbursement claim"}
                          </div>
                          {c.scenario && (
                            <div className="text-[11px] text-graphite/85 italic mt-0.5 max-w-md">{c.scenario}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 num text-right whitespace-nowrap">
                          {(() => {
                            const charged = Number(c.amount_inr);
                            const allowed = c.amount_allowed == null ? null : Number(c.amount_allowed);
                            const partial = allowed != null && allowed > 0.01 && allowed < charged - 0.01;
                            return partial ? (
                              <>
                                <div>{inr(allowed)}</div>
                                <div className="text-[10.5px] text-graphite">of {inr(charged)}</div>
                              </>
                            ) : inr(charged);
                          })()}
                        </td>
                        <td className="px-2 py-2">
                          <Chip tone={statusTone(c.status)}>{c.status}</Chip>
                          {(() => { const t2 = trustSummary(buildChecks(c));
                            return t2.text === "not run" ? null : (
                              <div className="mt-0.5"><Chip tone={t2.tone}>{t2.text}</Chip></div>
                            ); })()}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Btn small tone="ghost" onClick={(e: any) => { e.stopPropagation(); setOpenCase(c.id); runCase(c.id); }}>
                            {c.status === "queued" ? "Run" : "Re-run"}
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-1 mb-2">
                {(["workpaper", "trace"] as const).map((t2) => (
                  <button key={t2} onClick={() => setPane(t2)}
                    className={`px-2.5 py-1 text-[10.5px] uppercase tracking-[0.14em] font-semibold rounded-sm border
                      ${pane === t2 ? "border-paper/50 text-paper bg-ink2" : "border-transparent text-paper/50 hover:text-paper/80"}`}>
                    {t2 === "workpaper" ? "The decision" : "What actually happened"}
                  </button>
                ))}
              </div>
              {!current ? (
                <div className="paper p-6 text-[13px] text-graphite">Pick a charge.</div>
              ) : pane === "workpaper" ? (
                <Workpaper c={current} onReviewed={load} />
              ) : (
                <Trace runs={(state.caseRuns || []).filter((r: any) => r.case_id === current.id)} />
              )}
            </section>
          </div>
        )}

        {view === "escalations" && <Escalations state={state} reload={load} say={say} />}
        {view === "ledger" && <Ledger />}
        {view === "policy" && <Policy state={state} reload={load} say={say} />}
        {view === "precedents" && <Precedents state={state} />}
        {view === "settings" && (
          <Settings state={state} reload={load} say={say} dev={dev} />
        )}
        {view === "evals" && <Evals state={state} reload={load} say={say} />}
        {view === "governance" && <Governance say={say} />}
        {view === "terms" && <Terms state={state} reload={load} say={say} />}
        {view === "intake" && <Intake state={state} reload={load} say={say} />}
        {view === "agents" && dev && <Agents />}
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-ink text-paper px-4 py-2 rounded-sm text-[12.5px] shadow-lg rise">
          {toast}
        </div>
      )}
    </div>
  );
}

function Settings({ state, reload, say, dev }: any) {
  const [section, setSection] = useState<string>("terms");
  const sections = [...SETTINGS_SECTIONS, ...(dev ? [["agents", "The six agents", "What each one is given and what it returns."] as const] : [])];
  const current = sections.find((x) => x[0] === section) || sections[0];

  return (
    <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-5">
      <nav className="space-y-0.5">
        {sections.map(([k, name, blurb]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`w-full text-left px-3 py-2 rounded-sm border transition-colors
              ${section === k ? "border-paper/40 bg-ink2 text-paper" : "border-transparent text-paper/70 hover:bg-ink2/60"}`}>
            <div className="text-[13px]">{name}</div>
            <div className="text-[11px] opacity-50 leading-snug">{blurb}</div>
          </button>
        ))}
      </nav>
      <div>
        <PaneTitle>{current[1]}</PaneTitle>
        {section === "policy" && <Policy state={state} reload={reload} say={say} />}
        {section === "terms" && <Terms state={state} reload={reload} say={say} />}
        {section === "governance" && <Governance say={say} />}
        {section === "evals" && <Evals state={state} reload={reload} say={say} />}
        {section === "agents" && dev && <Agents />}
      </div>
    </div>
  );
}

function Line({ ok, text, neutral }: { ok: boolean; text: string; neutral?: boolean }) {
  return (
    <div className="flex gap-1.5">
      <span className={`font-bold ${neutral ? "text-graphite" : ok ? "text-posted" : "text-held"}`}>
        {neutral ? "·" : ok ? "\u2713" : "!"}
      </span>
      <span className={neutral ? "text-graphite" : ""}>{text}</span>
    </div>
  );
}

function Stat({ label, value, alarm, note }: { label: string; value: string; alarm?: boolean; note?: string }) {
  return (
    <div title={note || ""}>
      <div className="opacity-55 uppercase tracking-[0.12em] text-[9.5px]">{label}</div>
      <div className={`num text-[15px] leading-tight ${alarm ? "text-[#FFB4B4]" : ""}`}>{value}</div>
      {note && <div className="opacity-40 text-[9px]">{note}</div>}
    </div>
  );
}

function PaneTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-paper/80 text-[10.5px] uppercase tracking-[0.18em] font-semibold mb-2">{children}</h2>
  );
}


/* ------------------------------- Escalations ------------------------------- */
function Escalations({ state, reload, say }: any) {
  const [draft, setDraft] = useState<Record<number, any>>({});
  const [working, setWorking] = useState<number | null>(null);
  const open = (state.escalations || []).filter((e: any) => e.status === "open");
  const done = (state.escalations || []).filter((e: any) => e.status === "resolved");

  const resolve = async (e: any, decision: string) => {
    const rationale = draft[e.id]?.rationale || "";
    if (!rationale.trim()) return say("Write the reason. It becomes the rule for next time.");
    /* Her proposal is what the box shows, so it is what gets sent unless it was
       edited. Agreeing with her should not require retyping her figure. */
    const allowRaw = draft[e.id]?.allow;
    const fallback = e.proposed_allowed != null ? Number(e.proposed_allowed) : Number(e.amount_inr);
    const allowed = decision === "REJECT" ? 0
      : allowRaw !== undefined && allowRaw !== "" ? Number(allowRaw)
      : fallback;
    setWorking(e.id);
    const r = await fetch("/api/escalations", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ escalationId: e.id, decision, rationale,
                             amountAllowed: allowed, resolvedBy: "Corporate Controller" }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Could not reach the server." }));
    if (r.ok && r.readyToClose) {
      await fetch("/api/step", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: r.caseId, step: "post" }) });
    }
    await reload();
    setWorking(null);
    if (!r.ok) return say(r.error || "That did not save.");
    say(r.precedent ? "Recorded. She will apply this herself next time." : "Recorded.");
  };

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <PaneTitle>Waiting on your decision</PaneTitle>
        {open.length === 0 && <div className="paper p-6 text-[13px] text-graphite">Nothing waiting on you.</div>}
        <div className="space-y-3">
          {open.map((e: any) => {
            const asksPermission = e.kind === "permission";
            const busy = working === e.id;
            const proposed = e.proposed_allowed == null ? null : Number(e.proposed_allowed);
            const charged = Number(e.amount_inr);
            const allowValue = draft[e.id]?.allow;
            return (
              <div key={e.id} className="paper p-4 rise">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="font-semibold text-[14px]">{e.merchant}</div>
                    <div className="text-[11.5px] text-graphite">
                      {e.employee_name} · {String(e.txn_date).slice(0, 10)} · <span className="num">{e.case_id}</span>
                    </div>
                  </div>
                  <div className="num text-lg">{inr(charged)}</div>
                </div>

                <div className="mt-3">
                  <Chip tone={asksPermission ? "blue" : "amber"}>
                    {asksPermission ? "She reached a view and needs your agreement" : "She could not decide this"}
                  </Chip>
                </div>

                <p className="text-[13px] mt-2">{e.question}</p>
                {e.recommendation && (
                  <div className="mt-2 border-l-2 border-rule pl-3">
                    <p className="text-[12.5px] text-graphite">{e.recommendation}</p>
                  </div>
                )}
                <div className="mt-2 text-[11.5px] text-graphite">{e.reason}</div>

                <div className="mt-3 flex gap-2 items-center flex-wrap">
                  <Label>Allow</Label>
                  <input className={inputCls + " max-w-[9rem]"} type="number"
                    value={allowValue ?? String(proposed ?? charged)}
                    onChange={(ev) => setDraft({ ...draft, [e.id]: { ...draft[e.id], allow: ev.target.value } })} />
                  <span className="text-[11.5px] text-graphite">of {inr(charged)}</span>
                  {allowValue !== undefined && allowValue !== String(proposed ?? charged) && (
                    <button className="text-[11.5px] underline text-graphite hover:text-ink"
                      onClick={() => setDraft({ ...draft, [e.id]: { ...draft[e.id], allow: undefined } })}>
                      reset
                    </button>
                  )}
                </div>

                <textarea
                  className={`${inputCls} mt-2 h-20`}
                  placeholder="Your reason. She turns this into a rule for next time."
                  value={draft[e.id]?.rationale || ""}
                  onChange={(ev) => setDraft({ ...draft, [e.id]: { ...draft[e.id], rationale: ev.target.value } })}
                />
                <div className="mt-2 flex gap-2 items-center">
                  <Btn tone="green" disabled={busy} onClick={() => resolve(e, "ALLOW")}>
                    {Number(allowValue ?? proposed ?? charged) >= charged - 0.01
                      ? "Allow in full" : `Allow ${inr(Number(allowValue ?? proposed ?? charged))}`}
                  </Btn>
                  <Btn tone="red" disabled={busy} onClick={() => resolve(e, "REJECT")}>Disallow</Btn>
                  {busy && <span className="text-[12px] text-graphite">recording…</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <PaneTitle>Decided by you</PaneTitle>
        {done.length === 0 && <div className="paper p-6 text-[13px] text-graphite">Nothing yet.</div>}
        {(() => {
          /* Only the ones where she had reached a view can be agreed or disagreed
             with. Answering a question she could not settle is neither. */
          const withView = done.filter((e: any) => e.kind === "permission" && e.aria_verdict);
          if (!withView.length) return null;
          const changed = withView.filter((e: any) => e.human_decision !== e.aria_verdict).length;
          return (
            <div className="paper p-3 mb-3">
              <div className="text-[12.5px]">
                Of the <span className="num font-semibold">{withView.length}</span> she sent up with a view
                already formed, you decided differently on <span className="num font-semibold">{changed}</span>.
              </div>
              <p className="text-[11.5px] text-graphite mt-1">
                {changed === 0
                  ? "Her limits are tighter than they need to be. Raise them under Settings."
                  : changed / withView.length > 0.4
                  ? "You are changing her often. Either her limits are too loose, or the policy is unclear here."
                  : "A healthy mix."}
              </p>
            </div>
          );
        })()}
        <div className="space-y-2">
          {done.map((e: any) => (
            <div key={e.id} className="paper p-3">
              <div className="flex justify-between text-[13px]">
                <span className="font-semibold">{e.merchant}</span>
                <Chip tone={e.human_decision === "REJECT" ? "red" : "green"}>
                  {e.human_decision === "REJECT" ? "disallowed" : "allowed"}
                </Chip>
              </div>
              <p className="text-[12px] text-graphite mt-1">{e.human_rationale}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- Ledger --------------------------------- */
function Ledger() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch("/api/ledger", { cache: "no-store" }).then((r) => r.json()).then(setD); }, []);
  if (!d) return <div className="paper p-6 text-[13px]">Reading the ledger…</div>;
  const balanced = Math.abs(Number(d.totals.debit) - Number(d.totals.credit)) < 0.01;

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section>
        <PaneTitle>Trial balance</PaneTitle>
        {(() => {
          const tax = d.trialBalance
            .filter((r: any) => r.type === "tax")
            .reduce((n: number, r: any) => n + Number(r.debit || 0), 0);
          if (tax <= 0) return null;
          return (
            <div className="paper p-3 mb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px]">
                  <span className="font-semibold">{inr(tax)}</span> of input tax split out and claimable.
                </span>
                <Chip tone="green">recoverable</Chip>
              </div>
              <p className="text-[11.5px] text-graphite mt-1">
                Separated from the expense on every charge where the vendor registration number was on
                the receipt. Buried in the expense line it would simply be lost.
              </p>
            </div>
          );
        })()}
        <div className="paper p-4">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-graphite text-[10px] uppercase tracking-[0.12em]">
                <th className="text-left font-semibold py-1">Account</th>
                <th className="text-right font-semibold py-1">Debit</th>
                <th className="text-right font-semibold py-1">Credit</th>
              </tr>
            </thead>
            <tbody className="ruled">
              {d.trialBalance.map((r: any) => (
                <tr key={r.account_code}>
                  <td className="py-1.5"><span className="num">{r.account_code}</span> <span className="text-graphite">{r.account_name}</span></td>
                  <td className="py-1.5 num text-right">{Number(r.debit) ? inr(r.debit) : ""}</td>
                  <td className="py-1.5 num text-right">{Number(r.credit) ? inr(r.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="double-rule">
                <td className="py-2 text-[11px] uppercase tracking-[0.12em] font-semibold">
                  {balanced ? <span className="text-posted">In balance</span> : <span className="text-flagged">Out of balance</span>}
                </td>
                <td className="py-2 num text-right font-semibold">{inr(d.totals.debit)}</td>
                <td className="py-2 num text-right font-semibold">{inr(d.totals.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section>
        <PaneTitle>Entries Aria posted</PaneTitle>
        <div className="space-y-2">
          {d.entries.length === 0 && <div className="paper p-6 text-[13px] text-graphite">Nothing posted yet.</div>}
          {d.entries.map((e: any) => (
            <div key={e.id} className="paper p-3">
              <div className="flex justify-between text-[12.5px]">
                <span className="num font-semibold">{e.entry_ref}</span>
                <span className="text-graphite">{e.merchant} · {e.employee_name}</span>
              </div>
              <table className="w-full mt-2 text-[12px]">
                <tbody className="ruled">
                  {d.lines.filter((l: any) => l.entry_id === e.id).map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-1"><span className="num">{l.account_code}</span> <span className="text-graphite">{l.account_name}</span></td>
                      <td className="py-1 num text-graphite">{l.cost_center}</td>
                      <td className="py-1 num text-right">{Number(l.debit) ? inr(l.debit) : ""}</td>
                      <td className="py-1 num text-right">{Number(l.credit) ? inr(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- Policy --------------------------------- */
function Policy({ state, reload, say }: any) {
  const [body, setBody] = useState(state.policy?.body || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setBody(state.policy?.body || ""); }, [state.policy?.version]);

  const save = async () => {
    setSaving(true);
    await fetch("/api/policy", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, note: note || "Edited in console" }) });
    await reload(); setSaving(false); setNote("");
    say("Policy published. Re-run any charge and Aria will apply the new text.");
  };

  const requeue = async () => {
    await fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "cases" }) });
    await reload();
    say("Every charge is back in the queue. Work it again against the new policy.");
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
      <section>
        <PaneTitle>The policy Aria applies</PaneTitle>
        <div className="paper p-4">
          <p className="text-[12.5px] text-graphite mb-3">
            This document is the whole of the law. Change a limit, add a clause, delete a section.
            Aria reads it at the moment she decides, so the next charge is judged against whatever
            is here. Nothing about these rules is written into the code.
          </p>
          <textarea className={`${inputCls} h-[26rem] font-mono text-[12px] leading-relaxed`}
            value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-3 flex gap-2 items-center">
            <input className={inputCls + " max-w-xs"} placeholder="What changed, in a few words"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <Btn onClick={save} disabled={saving}>{saving ? "Publishing…" : "Publish new version"}</Btn>
            <Btn tone="ghost" onClick={requeue}>Re-queue every charge</Btn>
          </div>
        </div>
      </section>
      <section>
        <PaneTitle>Versions</PaneTitle>
        <div className="paper p-3 space-y-2">
          {(state.policyHistory || []).map((p: any) => (
            <div key={p.version} className="flex justify-between text-[12.5px] border-b border-rule pb-1.5 last:border-0">
              <span className="num font-semibold">v{p.version}</span>
              <span className="text-graphite text-right">{p.note}</span>
            </div>
          ))}
        </div>
        <p className="text-paper/60 text-[11.5px] mt-3 leading-relaxed">
          Versions are never overwritten. Every past decision stays attributable to the text that was
          live when it was made, which is what makes the audit trail worth anything.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------- Precedents ------------------------------- */
function Precedents({ state }: any) {
  const p = state.precedents || [];
  return (
    <div className="max-w-3xl">
      <PaneTitle>Precedents you have set</PaneTitle>
      <div className="paper p-4">
        <p className="text-[12.5px] text-graphite mb-3">
          Every time the Controller answers an escalation, the ruling is generalised and filed here.
          Aria reads the book before she decides. This is the difference between an agent that asks the
          same question forever and one that learns its manager&rsquo;s judgment.
        </p>
        {p.length === 0 && <p className="text-[13px] text-graphite">Empty. Resolve an escalation to write the first entry.</p>}
        <div className="space-y-3">
          {p.map((x: any) => (
            <div key={x.id} className="border border-rule bg-white/60 rounded-sm p-3">
              <div className="flex gap-2 flex-wrap mb-1">
                <Chip tone={x.decision === "REJECT" ? "red" : x.decision === "PARTIAL" ? "amber" : "green"}>{x.decision}</Chip>
                {x.category && <Chip>{x.category}</Chip>}
                {x.amount_band && <Chip>{x.amount_band}</Chip>}
                {x.merchant && <Chip tone="blue">{x.merchant}</Chip>}
              </div>
              <div className="text-[13px] font-semibold">{x.situation}</div>
              <div className="text-[12.5px] text-graphite mt-0.5">{x.rationale}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Evals ---------------------------------- */
function Evals({ state, reload, say }: any) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [prog, setProg] = useState<any>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async () => {
    if (!state.evalCount) {
      say("There is no answer key for this policy yet. See the note above.");
      return;
    }
    setRunning(true); setRows([]); setProg({ done: 0, total: state.evalCount }); setFailed(null);
    let offset = 0, runId: any = null, all: any[] = [];
    while (true) {
      let r: any;
      try {
        r = await fetch("/api/evals", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, limit: 5, runId }) }).then((x) => x.json());
      } catch (e: any) {
        setFailed(e.message || "The request did not come back."); break;
      }
      if (!r.ok) { setFailed(r.error || "The run failed."); break; }
      if (!r.results?.length && !r.done) { setFailed("The review returned nothing. Check the connection at /api/health."); break; }
      runId = r.runId; all = [...all, ...r.results];
      setRows(all); setProg(r.progress);
      if (r.done) break;
      offset = r.progress.done;
    }
    setRunning(false); await reload();
  };

  const correct = rows.filter((r) => r.correct).length;
  const last = state.evalRuns?.[0];

  return (
    <div className="max-w-5xl">
      <PaneTitle>Evaluation</PaneTitle>
      <div className="paper p-4">
        {failed && (
          <div className="mb-3 bg-flagged text-white px-3 py-2 rounded-sm text-[12.5px]">{failed}</div>
        )}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {state.evalCount ? (
            <p className="text-[12.5px] text-graphite max-w-2xl">
{state.evalCount} charges you have already settled, with the answer you gave. She is scored
              against them using the policy as it stands today, so changing the policy changes the score.
              This is the evidence for widening what she may do without asking you.
            </p>
          ) : (
            <p className="text-[12.5px] text-graphite max-w-2xl">
<span className="font-semibold text-ink">Nothing to score her against yet.</span> Take twenty or
              thirty charges you have already settled, record what you decided and why, and she can be
              measured against them. Until then, keep her in shadow and compare her with the people doing
              the work today.
            </p>
          )}
          <Btn onClick={run} disabled={running || !state.evalCount}>
            {running ? `Running ${prog?.done ?? 0} of ${prog?.total ?? state.evalCount}` : "Run the review"}
          </Btn>
        </div>

        {(rows.length > 0 || last) && (
          <div className="mt-4 flex flex-wrap gap-6 border-t border-rule pt-3">
            <Stat2 label="She agreed with you on" value={rows.length ? `${Math.round((correct / rows.length) * 100)}%` : `${Math.round((last.correct / last.total) * 100)}%`} />
            <Stat2 label="Cases scored" value={rows.length ? `${correct}/${rows.length}` : `${last.correct}/${last.total}`} />
            <Stat2 label="She would have asked you" value={`${String(rows.length ? rows.filter((r) => String(r.got).toUpperCase() === "ESCALATE").length : last.escalations)} times`} />
            <Stat2 label="Time per charge" value={`${((rows.length ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / rows.length) : last.avg_latency_ms) / 1000).toFixed(1)}s`} />
          </div>
        )}

        {rows.length > 0 && (
          <table className="w-full mt-4 text-[12.5px]">
            <thead>
              <tr className="text-graphite text-[10px] uppercase tracking-[0.12em]">
                <th className="text-left font-semibold py-1">Case</th>
                <th className="text-left font-semibold py-1">Human</th>
                <th className="text-left font-semibold py-1">Aria</th>
                <th className="text-left font-semibold py-1">Her reading</th>
              </tr>
            </thead>
            <tbody className="ruled">
              {rows.map((r) => (
                <tr key={r.id} className={r.correct ? "" : "bg-[#F5E3E3]/40"}>
                  <td className="py-1.5 pr-2">{r.label}</td>
                  <td className="py-1.5"><Chip>{r.expected}</Chip></td>
                  <td className="py-1.5"><Chip tone={r.correct ? "green" : "red"}>{r.got}</Chip></td>
                  <td className="py-1.5 text-graphite text-[11.5px]">{r.reasoning || r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-graphite font-semibold">{label}</div>
      <div className="num text-xl">{value}</div>
    </div>
  );
}


/* ------------------------------- Governance ------------------------------- */
function Governance({ say }: any) {
  const [d, setD] = useState<any>(null);
  const load = async () => setD(await fetch("/api/governance", { cache: "no-store" }).then((r) => r.json()));
  useEffect(() => { load(); }, []);

  const set = async (patch: any) => {
    await fetch("/api/governance", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(patch) });
    await load();
    say("Applied. It takes effect on the next case she picks up.");
  };

  if (!d) return <div className="paper p-6 text-[13px]">Reading the controls…</div>;
  if (!d.ok) return <div className="paper p-6 text-[13px] text-flagged">{d.error}</div>;
  const s = d.state;

  const MODES: [string, string, string][] = [
    ["shadow", "Shadow", "She decides and records. She never acts. Compare her against the people doing the same work."],
    ["suggest", "Suggest", "Every decision goes to a person. Nothing is autonomous."],
    ["autonomous", "Autonomous", "She acts inside her authority and refers the rest upward."],
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section>
        <PaneTitle>How she is running</PaneTitle>
        <div className="paper p-4 space-y-4">
          <div>
            <Label>Deployment rung</Label>
            <div className="space-y-1.5">
              {MODES.map(([k, name, blurb]) => (
                <button key={k} onClick={() => set({ mode: k })}
                  className={`w-full text-left border rounded-sm px-3 py-2 transition-colors
                    ${s.mode === k ? "border-stamp bg-[#E4E9F6]" : "border-rule bg-white/60 hover:bg-paper2"}`}>
                  <div className="text-[13px] font-semibold">{name}</div>
                  <div className="text-[11.5px] text-graphite">{blurb}</div>
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-graphite mt-2">
              Move her up a rung when the review under Evaluation supports it.
            </p>
          </div>

          <div className="border-t border-rule pt-3">
            <Label>Recording</Label>
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={s.trace_enabled !== false} className="accent-[#2E4FA3]"
                onChange={(e) => set({ trace_enabled: e.target.checked })} />
              Record every step of every charge in full
            </label>
            <p className="text-[11.5px] text-graphite mt-1">
              On, you can read every step of any charge under <span className="font-semibold">What actually happened</span>.
              Off, only timings and cost are kept. Personal data is removed either way.
            </p>
          </div>

          <div className="border-t border-rule pt-3">
            <Label>Start over</Label>
            <div className="flex items-center gap-3">
              <Btn tone="ghost" onClick={async () => {
                if (!confirm("This erases the hire, the policy, the books, the people and all work. Walk onboarding again?")) return;
                await fetch("/api/onboard", { method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ step: "reset" }) });
                location.reload();
              }}>Erase everything and re-hire</Btn>
              <span className="text-[11.5px] text-graphite">Takes you back through onboarding.</span>
            </div>
          </div>

          <div className="border-t border-rule pt-3">
            <Label>Stop</Label>
            <div className="flex items-center gap-3">
              <Btn tone={s.paused ? "green" : "red"} onClick={() => set({ paused: !s.paused })}>
                {s.paused ? "Restart her" : "Stop her now"}
              </Btn>
              <span className="text-[12px] text-graphite">
                {s.paused ? "Stopped. Cases already in flight finished; nothing new starts." : "Running."}
              </span>
            </div>
          </div>

          <div className="border-t border-rule pt-3">
            <div className="flex justify-between items-baseline">
              <Label>Her own spend today</Label>
              <span className="num text-[13px] font-semibold">
                ${s.spentToday.toFixed(2)} of ${s.cap.toFixed(0)}
              </span>
            </div>
            <div className="h-2.5 w-full bg-paper2 border border-rule rounded-sm overflow-hidden">
              <div className={`h-full ${s.capReached ? "bg-flagged" : "bg-posted"}`}
                   style={{ width: `${Math.min(100, (s.spentToday / Math.max(s.cap, 0.0001)) * 100)}%` }} />
            </div>
            <div className="mt-2 flex gap-2 items-center">
              <input type="number" step="0.5" defaultValue={s.cap} className={inputCls + " max-w-[7rem]"}
                onBlur={(e) => set({ daily_spend_cap_usd: Number(e.target.value) })} />
              <span className="text-[11.5px] text-graphite">
                She stops working when she reaches this in a day. It is a brake, not a bill.
              </span>
            </div>
          </div>
        </div>

        <PaneTitle>The record</PaneTitle>
        <div className="paper p-4">
          <div className="flex items-baseline gap-2">
            <Chip tone={d.chain.intact ? "green" : "red"}>
              {d.chain.intact ? "Nothing has been altered" : `Altered at entry ${d.chain.brokenAt}`}
            </Chip>
            <span className="text-[12px] text-graphite num">{d.chain.entries} decisions recorded</span>
          </div>
          <p className="text-[12.5px] text-graphite mt-2">
            {d.chain.intact
              ? "Every decision is stored with a fingerprint of the one before it, so changing an old record after the fact would break the sequence. Nothing has. This is what an auditor asks for."
              : "The sequence is broken, which means a record was changed after it was written. Treat everything from that point on as unreliable and find out what happened."}
          </p>
        </div>

        <PaneTitle>What was stopped before it reached her</PaneTitle>
        <div className="paper p-4">
          {(() => {
            const by = Object.fromEntries((d.events || []).map((e: any) => [e.kind, e.n]));
            const pii = by.pii_redacted || 0;
            const cite = by.citation_unverified || 0;
            const gap = by.evidence_gap || 0;
            if (!pii && !cite && !gap) return (
              <p className="text-[12.5px] text-graphite">Nothing yet. Work some charges first.</p>
            );
            return (
              <ul className="text-[12.5px] space-y-1.5">
                {pii > 0 && <li>
                  Card numbers, tax identifiers, personal email and phone numbers were removed from{" "}
                  <span className="num font-semibold">{pii}</span> records before she saw them.
                </li>}
                {cite > 0 && <li>
                  <span className="num font-semibold">{cite}</span> decisions rested on a clause that
                  turned out not to be in your policy. They came to you instead of being settled.
                </li>}
                {gap > 0 && <li>
                  <span className="num font-semibold">{gap}</span> charges would have been allowed
                  without the receipt your policy requires. They came to you instead.
                </li>}
              </ul>
            );
          })()}
        </div>
      </section>
    </div>
  );
}

const GUARD_BLURB: Record<string, string> = {
  pii_redacted: "Personal data removed before she saw it",
  citation_unverified: "Quoted a clause not found in your policy, so it came to you",
  spend_cap: "Stopped at the daily cost cap",
  paused: "Work attempted while she was stopped",
  undeclared_hedge: "Declined to decide without naming a reason the policy allows",
  match_amount_mismatch: "A receipt was proposed as a match whose total was nothing like the charge",
};

/* --------------------------------- Terms ---------------------------------- */
function Terms({ state, reload, say }: any) {
  const [a, setA] = useState<any>(state.authority);
  useEffect(() => setA(state.authority), [state.authority]);
  if (!a) return null;

  const save = async () => {
    await fetch("/api/authority", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
    await reload(); say("Terms updated. They apply to the next decision she makes.");
  };

  return (
    <div className="max-w-2xl">
      <PaneTitle>What she may do without asking</PaneTitle>
      <div className="paper p-5">
        <p className="text-[12.5px] text-graphite mb-4">
What she may do without asking you. The judgement is hers; these limits are not. They are applied
          after she has decided, so nothing written in a receipt or a memo can widen them.
        </p>
        <div className="space-y-4">
          <Slider label="Approve without asking, up to" value={Number(a.auto_approve_limit)} min={0} max={500000} step={5000}
            fmt={inr} onChange={(v: number) => setA({ ...a, auto_approve_limit: v })} />
          <Slider label="Disallow on her own, up to" value={Number(a.auto_reject_limit)} min={0} max={300000} step={5000}
            fmt={inr} onChange={(v: number) => setA({ ...a, auto_reject_limit: v })} />
          <div>
            <Label>Refer upward when investigation risk reaches</Label>
            <select className={inputCls + " max-w-xs"} value={a.escalate_risk_at}
              onChange={(e) => setA({ ...a, escalate_risk_at: e.target.value })}>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="flex gap-5">
            <Toggle label="May post to the ledger" v={a.can_post_ledger} on={(v: boolean) => setA({ ...a, can_post_ledger: v })} />
            <Toggle label="May disallow a charge" v={a.can_reject} on={(v: boolean) => setA({ ...a, can_reject: v })} />
          </div>
        </div>
        <div className="mt-5"><Btn onClick={save}>Update her terms</Btn></div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }: any) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <Label>{label}</Label>
        <span className="num text-[13px] font-semibold">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#2E4FA3]" />
    </div>
  );
}

function Toggle({ label, v, on }: any) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
      <input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} className="accent-[#2E4FA3]" />
      {label}
    </label>
  );
}

/* --------------------------------- Intake --------------------------------- */
function Intake({ state, reload, say }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({
    employee_id: state.employees?.[0]?.id, merchant: "", amount: "", currency: "INR",
    txn_date: today, txn_time: "", source: "card_feed", memo: "", receipt_text: "",
  });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [extract, setExtract] = useState<any>(null);
  const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);

  /* Reading a receipt and entering a charge sat side by side as though they were
     separate jobs. They are one job with an optional first step, because the
     receipt fills in most of the form. */
  const upload = async (file: File) => {
    setReading(true); setExtract(null);
    const b64: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej; r.readAsDataURL(file);
    });
    const r = await fetch("/api/receipts", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ employee_id: f.employee_id, image_b64: b64, media: file.type }) }).then((x) => x.json());
    setReading(false);
    if (!r.ok) return say(r.error);
    setUploadedReceiptId(r.id);
    setExtract(r);
    const ex = r.extracted || {};
    setF((p2: any) => ({
      ...p2,
      merchant: ex.merchant || p2.merchant,
      amount: ex.total ?? p2.amount,
      currency: ex.currency || p2.currency,
      txn_date: /^\d{4}-\d{2}-\d{2}$/.test(ex.date || "") ? ex.date : p2.txn_date,
      receipt_text: ex.transcribed_text || p2.receipt_text,
    }));
    await reload();
  };

  const add = async () => {
    if (!f.merchant || !f.amount) return say("A merchant and an amount, at least.");
    setBusy(true);
    const r = await fetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, receipt_id: uploadedReceiptId }) }).then((x) => x.json());
    setBusy(false);
    if (!r.ok) return say(r.error);
    await reload();
    say(`On the queue as ${r.caseId}. Open the queue and run it.`);
    setF({ ...f, merchant: "", amount: "", memo: "", receipt_text: "" });
    setUploadedReceiptId(null); setExtract(null);
  };

  return (
    <div className="max-w-3xl">
      <PaneTitle>Enter a charge by hand</PaneTitle>
      <div className="paper p-4 space-y-4">
        <p className="text-[12.5px] text-graphite">
For spend that never reached the card feed, or a charge you want her to look at now.
        </p>

        <div className="border border-rule bg-white/60 rounded-sm p-3">
          <Label>Start with the receipt, if there is one</Label>
          <input type="file" accept="image/*" className="text-[12.5px] mt-1"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {reading && <div className="text-[12px] text-graphite mt-2">Reading it…</div>}
          {extract && (
            <div className="mt-2">
              <Chip tone="green">Read. The fields below were filled in from it.</Chip>
              {extract.priorSubmissions?.length > 0 && (
                <div className="mt-2 text-[12px] text-flagged">This receipt has been submitted before.</div>
              )}
              {(extract.extracted?.internal_inconsistencies || []).length > 0 && (
                <ul className="text-[12px] text-flagged mt-1.5 space-y-0.5">
                  {extract.extracted.internal_inconsistencies.map((x: string, i: number) => <li key={i}>· {x}</li>)}
                </ul>
              )}
            </div>
          )}
          <p className="text-[11.5px] text-graphite mt-2">
She will not tell you whether a receipt image is genuine, because nothing can do that reliably.
            What she checks is whether anything outside the claimant&rsquo;s own paperwork supports the claim.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee">
            <select className={inputCls} value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
              {(state.employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.name} · {e.grade}</option>)}
            </select>
          </Field>
          <Field label="Merchant">
            <input className={inputCls} value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} />
          </Field>
          <Field label="Amount">
            <input className={inputCls} type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {["INR", "USD", "SGD", "AED", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className={inputCls} type="date" value={f.txn_date} onChange={(e) => setF({ ...f, txn_date: e.target.value })} /></Field>
          <Field label="Time"><input className={inputCls} placeholder="21:40" value={f.txn_time} onChange={(e) => setF({ ...f, txn_time: e.target.value })} /></Field>
          <Field label="How it was paid">
            <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="card_feed">Company card</option>
              <option value="employee_claim">Employee paid, claiming it back</option>
            </select>
          </Field>
          <Field label="Memo"><input className={inputCls} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></Field>
        </div>

        <Field label="What the receipt says">
          <textarea className={`${inputCls} h-28 font-mono text-[11.5px]`} value={f.receipt_text}
            placeholder="Filled in from the upload, or type it if you only have a paper copy."
            onChange={(e) => setF({ ...f, receipt_text: e.target.value })} />
        </Field>

        <Btn onClick={add} disabled={busy}>{busy ? "Adding…" : "Add to the queue"}</Btn>
      </div>
    </div>
  );
}
