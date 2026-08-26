"use client";
import React, { useEffect, useState } from "react";
import { Btn, Chip, Field, Label, inputCls, inr } from "./ui";

const STEPS = [
  ["company", "The employer", "Who she works for"],
  ["policy", "The policy", "The rules she applies"],
  ["books", "The books", "Where she may post"],
  ["people", "The people", "Whose spend she reviews"],
  ["authority", "Her authority", "What she may do unasked"],
  ["mode", "How she starts", "Shadow, suggest, or acting"],
  ["work", "Day one", "What is waiting for her"],
] as const;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    let r = await fetch("/api/onboard", { cache: "no-store" }).then((x) => x.json());
    if (!r.ok && r.needsBootstrap) {
      await fetch("/api/bootstrap", { method: "POST" });
      r = await fetch("/api/onboard", { cache: "no-store" }).then((x) => x.json());
    }
    setD(r);
    return r;
  };
  useEffect(() => { load(); }, []);

  const send = async (step: string, data: any) => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/onboard", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ step, data }) }).then((x) => x.json());
    setBusy(false);
    if (!r.ok) { setErr(r.error); return false; }
    await load();
    return true;
  };

  if (!d) {
    return <div className="min-h-screen grid place-items-center text-paper">
      <div className="text-[11px] uppercase tracking-[0.2em] opacity-60">Preparing</div>
    </div>;
  }

  const key = STEPS[i][0];
  const next = async (step: string, data: any) => {
    if (await send(step, data)) setI(Math.min(i + 1, STEPS.length - 1));
  };

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="px-6 py-5 border-b border-ink3">
        <div className="text-[10px] uppercase tracking-[0.2em] opacity-55">Hiring</div>
        <h1 className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          A Travel and Expense Controller
        </h1>
        <p className="text-[13px] opacity-70 mt-1 max-w-2xl">
          Everything she applies, posts to and recognises comes from the next seven screens. All of it can
          be changed later.
        </p>
      </header>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6 p-6">
        <nav className="space-y-0.5">
          {STEPS.map(([k, name, blurb], n) => (
            <button key={k} onClick={() => setI(n)}
              className={`w-full text-left px-3 py-2 rounded-sm border transition-colors
                ${n === i ? "border-paper/40 bg-ink2" : "border-transparent hover:bg-ink2/60"}`}>
              <div className="flex items-baseline gap-2">
                <span className="num text-[10px] opacity-45">{String(n + 1).padStart(2, "0")}</span>
                <span className={`text-[13px] ${n === i ? "" : "opacity-75"}`}>{name}</span>
              </div>
              <div className="text-[11px] opacity-45 pl-6">{blurb}</div>
            </button>
          ))}
          {d.missing?.length > 0 && (
            <p className="text-[11px] opacity-55 pt-3 leading-relaxed">
              Still needed: {d.missing.join(", ")}.
            </p>
          )}
        </nav>

        <main className="max-w-3xl">
          {err && <div className="mb-3 bg-flagged text-white px-3 py-2 rounded-sm text-[12.5px]">{err}</div>}

          {key === "company" && <Company d={d} busy={busy} next={next} />}
          {key === "policy" && <Policy d={d} busy={busy} next={next} />}
          {key === "books" && <Books d={d} busy={busy} next={next} />}
          {key === "people" && <People d={d} busy={busy} next={next} />}
          {key === "authority" && <Authority d={d} busy={busy} next={next} />}
          {key === "mode" && <Mode d={d} busy={busy} next={next} />}
          {key === "work" && <Work d={d} busy={busy} send={send} onDone={onDone} setErr={setErr} />}
        </main>
      </div>
    </div>
  );
}

function Card({ title, why, children }: any) {
  return (
    <div className="paper p-5 text-ink">
      <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{title}</h2>
      <p className="text-[12.5px] text-graphite mt-1 mb-4 leading-relaxed">{why}</p>
      {children}
    </div>
  );
}

/* --------------------------------- 1 --------------------------------- */
function Company({ d, busy, next }: any) {
  const c = d.company || {};
  const [f, setF] = useState<any>({
    name: c.name || "", legal_entity: c.legal_entity || "",
    home_currency: c.home_currency || "INR", jurisdiction: c.jurisdiction || "India",
    fiscal_year_start: c.fiscal_year_start || "April",
    agent_name: c.agent_name === "the Controller" ? "" : c.agent_name || "",
    reports_to: c.reports_to || "Corporate Controller",
  });
  return (
    <Card title="Who she works for"
      why="Currency and jurisdiction decide whether input tax is recoverable and how a foreign charge is converted, so they change what she posts.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company"><input className={inputCls} value={f.name} placeholder="Meridian Systems"
          onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Legal entity"><input className={inputCls} value={f.legal_entity}
          placeholder="Meridian Systems India Private Limited"
          onChange={(e) => setF({ ...f, legal_entity: e.target.value })} /></Field>
        <Field label="Home currency">
          <select className={inputCls} value={f.home_currency} onChange={(e) => setF({ ...f, home_currency: e.target.value })}>
            {["INR", "USD", "SGD", "AED", "EUR", "GBP"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Jurisdiction">
          <select className={inputCls} value={f.jurisdiction} onChange={(e) => setF({ ...f, jurisdiction: e.target.value })}>
            {["India", "Singapore", "United Arab Emirates", "United Kingdom", "United States"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Fiscal year starts">
          <select className={inputCls} value={f.fiscal_year_start} onChange={(e) => setF({ ...f, fiscal_year_start: e.target.value })}>
            {["January", "April", "July", "October"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="She reports to"><input className={inputCls} value={f.reports_to}
          onChange={(e) => setF({ ...f, reports_to: e.target.value })} /></Field>
      </div>

      <div className="mt-4 border-t border-rule pt-3">
        <Field label="What you want to call her">
          <input className={inputCls + " max-w-xs"} value={f.agent_name} placeholder="Leave blank for “the Controller”"
            onChange={(e) => setF({ ...f, agent_name: e.target.value })} />
        </Field>
        <p className="text-[11.5px] text-graphite mt-1">
          A name reinforces that this is a role rather than a tool. Leave it blank and she is simply the Controller.
        </p>
      </div>

      <div className="mt-4">
        <Btn disabled={busy || !f.name} onClick={() => next("company", f)}>Save and continue</Btn>
      </div>
    </Card>
  );
}

/* --------------------------------- 2 --------------------------------- */
function Policy({ d, busy, next }: any) {
  const onFile = d.current?.policy?.body || "";
  const [body, setBody] = useState(onFile);
  const has = d.counts?.policies > 0;
  const dirty = body.trim() !== onFile.trim();
  return (
    <Card title="The rules she applies"
      why="She reads this at the moment she decides and quotes the clause she relied on. Rewrite it whenever you like: the next charge is judged against the new version, with no release needed.">
      {has && (
        <div className="mb-3 flex gap-2 items-center flex-wrap">
          <Chip tone="green">Version {d.current?.policy?.version} is on file, {onFile.split(/\s+/).length} words</Chip>
          {dirty
            ? <Chip tone="amber">Edited. Saving publishes a new version.</Chip>
            : <Chip>Shown below, unchanged</Chip>}
        </div>
      )}
      <textarea className={`${inputCls} h-80 font-mono text-[11.5px] leading-relaxed`} value={body}
        placeholder="Paste your expense policy here, or load the starter below and edit it."
        onChange={(e) => setBody(e.target.value)} />
      <div className="mt-3 flex gap-2 flex-wrap">
        <Btn tone="ghost" onClick={() => setBody(d.starterPolicy)}>Load a starter policy</Btn>
        <Btn disabled={busy || !body.trim()}
          onClick={() => dirty || !has
            ? next("policy", { body, note: has ? "Edited during onboarding" : "Set during onboarding" })
            : next("noop", {})}>
          {has && !dirty ? "Keep this and continue" : "Save and continue"}
        </Btn>
      </div>
      <p className="text-[11.5px] text-graphite mt-2">
        The starter covers air travel, accommodation, meals, alcohol, ground transport, receipts, prohibited
        spend and tax. Numbered clauses are worth keeping: she cites them back, so you can check any
        decision against the rule it rests on.
      </p>
    </Card>
  );
}

/* --------------------------------- 3 --------------------------------- */
function Books({ d, busy, next }: any) {
  const fmtA = (rows: any[]) => (rows || []).map((a: any[]) => a.slice(0, 3).join(", ")).join("\n");
  const fmtC = (rows: any[]) => (rows || []).map((c: any[]) => c.slice(0, 2).join(", ")).join("\n");
  const [accounts, setAccounts] = useState<string>(fmtA(d.current?.accounts));
  const [centers, setCenters] = useState<string>(fmtC(d.current?.centers));
  const parse = (s: string, cols: number) =>
    s.split("\n").map((l) => l.split(",").map((x) => x.trim())).filter((r) => r.length >= cols && r[0]);

  return (
    <Card title="Where she may post"
      why="She may only post to accounts on this list. Anything outside it is caught before it reaches your ledger.">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Chart of accounts</Label>
          <textarea className={`${inputCls} h-48 font-mono text-[11px]`} value={accounts}
            placeholder="code, name, type&#10;6130, Travel - Meals, expense&#10;2110, Corporate Card Liability, liability"
            onChange={(e) => setAccounts(e.target.value)} />
          <p className="text-[11px] text-graphite mt-1">One per line: code, name, type.</p>
        </div>
        <div>
          <Label>Cost centres</Label>
          <textarea className={`${inputCls} h-48 font-mono text-[11px]`} value={centers}
            placeholder="code, name&#10;CC-ENG, Engineering&#10;CC-SAL, Sales"
            onChange={(e) => setCenters(e.target.value)} />
          <p className="text-[11px] text-graphite mt-1">One per line: code, name.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        <Btn tone="ghost" onClick={() => {
          setAccounts(d.standardAccounts.map((a: any[]) => `${a[0]}, ${a[1]}, ${a[2]}`).join("\n"));
          setCenters(d.standardCenters.map((c: any[]) => `${c[0]}, ${c[1]}`).join("\n"));
        }}>{d.counts?.accounts ? "Replace with a standard T&E chart" : "Use a standard T&E chart"}</Btn>
        <Btn disabled={busy || !accounts.trim() || !centers.trim()}
          onClick={() => next("books", {
            replace: true,
            accounts: parse(accounts, 3).map((r) => [r[0], r[1], r[2], null]),
            centers: parse(centers, 2).map((r) => [r[0], r[1]]),
          })}>Save and continue</Btn>
      </div>
      {d.counts?.accounts > 0 && (
        <p className="text-[11.5px] text-graphite mt-2">
          {d.counts.accounts} accounts and {d.counts.centers} cost centres are on file and shown above.
          Saving replaces them with whatever is in the boxes.
        </p>
      )}
    </Card>
  );
}

/* --------------------------------- 4 --------------------------------- */
function People({ d, busy, next }: any) {
  const [rows, setRows] = useState<string>(
    (d.current?.employees || []).map((e: any[]) => e.filter((x) => x != null).join(", ")).join("\n"));
  return (
    <Card title="Whose spend she reviews"
      why="Several policy clauses turn on seniority, so she needs to know who is who before she can apply them.">
      <Label>People</Label>
      <textarea className={`${inputCls} h-52 font-mono text-[11px]`} value={rows}
        placeholder="id, name, email, grade, department, cost centre, manager&#10;E-1001, Ananya Rao, ananya@x.com, M4 Senior Manager, Sales, CC-SAL, Vikram Shah"
        onChange={(e) => setRows(e.target.value)} />
      <p className="text-[11px] text-graphite mt-1">
        One per line: id, name, email, grade, department, cost centre, manager. Cost centre must exist
        in the chart you just set.
      </p>
      <div className="mt-3 flex gap-2 flex-wrap">
        <Btn tone="ghost" onClick={() => setRows(d.sampleTeam.map((e: any[]) => e.slice(0, 7).join(", ")).join("\n"))}>
          {d.counts?.employees ? "Replace with a sample team of six" : "Use a sample team of six"}
        </Btn>
        <Btn disabled={busy || !rows.trim()} onClick={() => next("people", {
          replace: true,
          employees: rows.split("\n").map((l) => l.split(",").map((x) => x.trim()))
            .filter((r) => r.length >= 6 && r[0])
            .map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6] || null, null]),
        })}>Save and continue</Btn>
      </div>
      {d.counts?.employees > 0 && (
        <p className="text-[11.5px] text-graphite mt-2">
          {d.counts.employees} people are on file and shown above. Saving replaces them with whatever is in the box.
        </p>
      )}
    </Card>
  );
}

/* --------------------------------- 5 --------------------------------- */
function Authority({ d, busy, next }: any) {
  const a = d.authority || {};
  const [f, setF] = useState<any>({
    auto_approve_limit: Number(a.auto_approve_limit ?? 100000),
    auto_reject_limit: Number(a.auto_reject_limit ?? 50000),
    min_confidence: Number(a.min_confidence ?? 0),
    escalate_risk_at: a.escalate_risk_at || "HIGH",
    can_post_ledger: a.can_post_ledger ?? true,
    can_reject: a.can_reject ?? true,
    daily_spend_cap_usd: Number(a.daily_spend_cap_usd ?? 25),
  });
  const S2 = ({ label, k, min, max, step, fmt }: any) => (
    <div>
      <div className="flex justify-between items-baseline">
        <Label>{label}</Label>
        <span className="num text-[13px] font-semibold">{fmt(f[k])}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={f[k]} className="w-full accent-[#2E4FA3]"
        onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </div>
  );
  return (
    <Card title="What she may do without asking"
      why="These are enforced after she decides rather than left to her judgement, so nothing written in a receipt or a memo can widen them.">
      <div className="space-y-4">
        <S2 label="Allow a charge on her own, up to" k="auto_approve_limit" min={0} max={500000} step={5000} fmt={inr} />
        <S2 label="Disallow a charge on her own, up to" k="auto_reject_limit" min={0} max={300000} step={5000} fmt={inr} />
        <S2 label="Cap on her own running cost per day" k="daily_spend_cap_usd" min={1} max={200} step={5} fmt={(v: number) => `$${v}`} />
        <div>
          <Label>Send it to you when investigation risk reaches</Label>
          <select className={inputCls + " max-w-xs"} value={f.escalate_risk_at}
            onChange={(e) => setF({ ...f, escalate_risk_at: e.target.value })}>
            <option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </div>
        <div className="flex gap-5">
          {[["can_post_ledger", "May post to the ledger"], ["can_reject", "May disallow a charge"]].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={!!f[k]} className="accent-[#2E4FA3]"
                onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4"><Btn disabled={busy} onClick={() => next("authority", f)}>Save and continue</Btn></div>
    </Card>
  );
}

/* --------------------------------- 6 --------------------------------- */
function Mode({ d, busy, next }: any) {
  const [m, setM] = useState(d.authority?.mode || "shadow");
  const OPTS: [string, string, string][] = [
    ["shadow", "Shadow", "She decides and records every charge. She never acts. Run this alongside whoever does the work today and compare."],
    ["suggest", "Suggest", "Every decision is put to a person with her reasoning attached. Nothing is autonomous."],
    ["autonomous", "Autonomous", "She acts inside the authority you just set and sends the rest to you."],
  ];
  return (
    <Card title="How she starts"
      why="Start her in shadow. She works every charge and acts on none, so you can compare her against the people doing the work today before anything is at stake.">
      <div className="space-y-2">
        {OPTS.map(([k, name, blurb]) => (
          <button key={k} onClick={() => setM(k)}
            className={`w-full text-left border rounded-sm px-3 py-2.5 transition-colors
              ${m === k ? "border-stamp bg-[#E4E9F6]" : "border-rule bg-white/60 hover:bg-paper2"}`}>
            <div className="text-[13.5px] font-semibold">{name}{k === "shadow" && <span className="text-graphite font-normal"> · recommended</span>}</div>
            <div className="text-[12px] text-graphite">{blurb}</div>
          </button>
        ))}
      </div>
      <div className="mt-4"><Btn disabled={busy} onClick={() => next("mode", { mode: m })}>Save and continue</Btn></div>
    </Card>
  );
}

/* --------------------------------- 7 --------------------------------- */
function Work({ d, busy, send, onDone, setErr }: any) {
  const [load, setLoad] = useState("sample");
  const finish = async () => {
    if (!(await send("work", { load }))) return;
    const r = await fetch("/api/onboard", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "commit" }) }).then((x) => x.json());
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  };
  return (
    <Card title="What is waiting for her"
      why="Your card feed will put charges here. To see how she works before connecting it, load a sample month or add a few charges by hand.">
      <div className="space-y-2">
        <button onClick={() => setLoad("sample")}
          className={`w-full text-left border rounded-sm px-3 py-2.5 ${load === "sample" ? "border-stamp bg-[#E4E9F6]" : "border-rule bg-white/60 hover:bg-paper2"}`}>
          <div className="text-[13.5px] font-semibold">A sample month, eighteen charges</div>
          <div className="text-[12px] text-graphite">
            Each one labelled with what it puts under pressure: a hotel over cap, alcohol on a team bill,
            business class with no approval, a claim with no card record, two charges split across one day.
            Four of the nine corroboration checks only work by looking across charges, so this is what
            lets you see them fire.
          </div>
        </button>
        <button onClick={() => setLoad("empty")}
          className={`w-full text-left border rounded-sm px-3 py-2.5 ${load === "empty" ? "border-stamp bg-[#E4E9F6]" : "border-rule bg-white/60 hover:bg-paper2"}`}>
          <div className="text-[13.5px] font-semibold">Nothing. Start empty.</div>
          <div className="text-[12px] text-graphite">
            Add charges yourself and watch each one go through. Honest about day one: with no history,
            the checks that compare across charges have nothing to compare against, exactly as they would
            for a human controller on their first morning.
          </div>
        </button>
      </div>
      {d.missing?.length > 0 && (
        <p className="text-[12px] text-held mt-3">Still needed before she can start: {d.missing.join(", ")}.</p>
      )}
      <div className="mt-4">
        <Btn disabled={busy || d.missing?.length > 0} onClick={finish}>
          {d.company?.agent_name && d.company.agent_name !== "the Controller"
            ? `Bring ${d.company.agent_name} on board`
            : "Bring her on board"}
        </Btn>
      </div>
    </Card>
  );
}
