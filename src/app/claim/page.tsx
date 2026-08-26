"use client";
import React, { useEffect, useState } from "react";
import { Btn, Chip, Field, Label, inputCls, inr } from "@/components/ui";

/**
 * The one surface an employee sees, and it exists for one reason.
 *
 * A corporate card charge arrives on its own: the feed is the record, and the
 * employee has nothing to do. A reimbursement has no such record. Nobody but the
 * claimant knows the spend happened, so the claimant has to start it, and the
 * evidence they supply is the only evidence there is.
 *
 * That asymmetry is the whole point of this screen. It is deliberately not an
 * expense report: no coding, no cost centre, no policy questions, no submit-for-
 * approval. Those are the Controller's job and they are done by the agent.
 */
export default function ClaimPage() {
  const [emps, setEmps] = useState<any[]>([]);
  const [co, setCo] = useState<any>(null);
  const [f, setF] = useState<any>({
    employee_id: "", merchant: "", amount: "", currency: "INR",
    txn_date: new Date().toISOString().slice(0, 10), memo: "", receipt_text: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [reading, setReading] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setEmps(d.employees || []);
      setCo(d.company || null);
      if (d.employees?.[0]) setF((p: any) => ({ ...p, employee_id: d.employees[0].id }));
    });
  }, []);

  const readReceipt = async (file: File) => {
    setReading(true); setExtracted(null);
    const b64: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej; r.readAsDataURL(file);
    });
    const r = await fetch("/api/receipts", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ employee_id: f.employee_id, image_b64: b64, media: file.type }) }).then((x) => x.json());
    if (r.ok) setUploadedReceiptId(r.id);
    setReading(false);
    if (!r.ok) return;
    setExtracted(r);
    const ex = r.extracted || {};
    setF((p: any) => ({
      ...p,
      merchant: ex.merchant || p.merchant,
      amount: ex.total ?? p.amount,
      currency: ex.currency || p.currency,
      txn_date: /^\d{4}-\d{2}-\d{2}$/.test(ex.date || "") ? ex.date : p.txn_date,
      receipt_text: ex.transcribed_text || p.receipt_text,
    }));
  };

  const submit = async () => {
    setBusy(true);
    const r = await fetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, source: "employee_claim", receipt_id: uploadedReceiptId }) }).then((x) => x.json());
    setBusy(false);
    if (r.ok) setDone(r);
  };

  const agent = co?.agent_name && co.agent_name !== "the Controller" ? co.agent_name : "the Controller";

  if (done) {
    return (
      <Shell>
        <div className="paper p-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.16em] text-graphite font-semibold">Filed</div>
          <h2 className="text-xl mt-1" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            That is all we need.
          </h2>
          <p className="text-[13px] text-graphite mt-2 max-w-md mx-auto leading-relaxed">
{agent} will match it to your trip, apply the expense policy, and either settle it or come back to you
            with one question. Nothing else is needed from you.
          </p>
          <p className="text-[12px] text-graphite mt-3 num">{done.caseId}</p>
          <div className="mt-4 flex gap-2 justify-center">
            <Btn tone="ghost" onClick={() => { setDone(null); setExtracted(null); setUploadedReceiptId(null);
              setF({ ...f, merchant: "", amount: "", memo: "", receipt_text: "" }); }}>File another</Btn>
            <Btn onClick={() => (window.location.href = "/")}>Done</Btn>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="paper p-6">
        <h2 className="text-xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Claim money you spent yourself
        </h2>
        <p className="text-[12.5px] text-graphite mt-1 leading-relaxed">
Anything on the company card is picked up automatically and you never have to file it. Use this only
          for money you paid yourself. The receipt is the only record that the spend happened, so it matters
          more here than anywhere else.
        </p>

        <div className="mt-5 border border-rule bg-white/60 rounded-sm p-3">
          <Label>Attach the receipt</Label>
          <input type="file" accept="image/*" className="text-[12.5px] mt-1"
            onChange={(e) => e.target.files?.[0] && readReceipt(e.target.files[0])} />
          {reading && <div className="text-[12px] text-graphite mt-2">Reading it…</div>}
          {extracted && (
            <div className="mt-2">
              <Chip tone="green">Read. The fields below were filled in from it.</Chip>
              {extracted.priorSubmissions?.length > 0 && (
                <div className="mt-2 text-[12px] text-flagged">
                  This receipt has already been submitted. Check before filing it again.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="You">
            <select className={inputCls} value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
              {emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Where you spent it">
            <input className={inputCls} value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} />
          </Field>
          <Field label="How much">
            <input className={inputCls} type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {["INR", "USD", "SGD", "AED", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="When">
            <input className={inputCls} type="date" value={f.txn_date} onChange={(e) => setF({ ...f, txn_date: e.target.value })} />
          </Field>
          <Field label="What it was for">
            <input className={inputCls} placeholder="Client workshop lunch" value={f.memo}
              onChange={(e) => setF({ ...f, memo: e.target.value })} />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="What the receipt says">
            <textarea className={`${inputCls} h-28 font-mono text-[11.5px]`} value={f.receipt_text}
              placeholder="Filled from the upload, or type it if you only have a paper copy."
              onChange={(e) => setF({ ...f, receipt_text: e.target.value })} />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Btn disabled={busy || !f.merchant || !f.amount} onClick={submit}>
            {busy ? "Filing…" : "File it"}
          </Btn>
          {f.amount && <span className="text-[12.5px] text-graphite num">{inr(f.amount)}</span>}
        </div>

        <p className="text-[11.5px] text-graphite mt-4 border-t border-rule pt-3 leading-relaxed">
Claims are reviewed more closely than card spend, because a card charge is already recorded by the bank
          and a claim is not. A clear, itemised receipt and a line on what it was for will usually settle it
          without anyone coming back to you.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink py-10 px-5">
      <div className="max-w-2xl mx-auto">
        <div className="text-paper mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-55">Reimbursement</div>
          <a href="/" className="text-[12px] opacity-60 hover:opacity-100 underline">back to the console</a>
        </div>
        {children}
      </div>
    </div>
  );
}
