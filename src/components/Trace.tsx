"use client";
import React, { useState } from "react";
import { Chip, Label } from "./ui";

const WHAT_IT_DOES: Record<string, { does: string; reads: string; decides: string }> = {
  gather: {
    does: "Finds the evidence a decision needs and matches at most one receipt to the charge.",
    reads: "The employee record, every receipt filed within fourteen days, calendar entries two days either side, and approved trips three days either side.",
    decides: "Which receipt belongs to this charge, what kind of spend it is, and what a careful reviewer would still want.",
  },
  corroborate: {
    does: "Checks the claim against records the claimant does not control.",
    reads: "Thirteen checks run across every charge in the company, plus the text of the receipt itself.",
    decides: "A risk band and a set of findings. It never claims to detect a generated image, because nothing can do that reliably.",
  },
  decide: {
    does: "Applies the policy and decides.",
    reads: "The entire live policy document, the evidence file, the investigation, and any past rulings on comparable cases.",
    decides: "Allow, disallow, allow in part, or refer it to you. Whichever it is, the clause is quoted and the quote is checked against your policy before the decision stands.",
  },
  post: {
    does: "Codes the charge and produces the journal entry.",
    reads: "The chart of accounts, the cost centres, the settled amount and the evidence.",
    decides: "Which accounts and cost centre bear the cost, and how tax is treated. The entry is checked to balance before anything is posted.",
  },
  read: {
    does: "Reads an uploaded receipt and records what it says.",
    reads: "The image or text as supplied.",
    decides: "Nothing. It records what the document says and flags what does not add up. Judging the charge is a later step.",
  },
  record: {
    does: "Turns a Controller's ruling into a standing rule.",
    reads: "The escalation, the recommendation, and what the Controller decided and why.",
    decides: "How far the ruling generalises. Too narrow and it never matches again, too broad and it overrides policy it was never meant to touch.",
  },
};

export default function Trace({ runs }: { runs: any[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!runs?.length) {
    return (
      <div className="paper p-5 text-[13px] text-graphite">
        Nothing recorded for this charge yet. Run it and every call will appear here.
      </div>
    );
  }

  const ms = runs.reduce((s, r) => s + Number(r.latency_ms || 0), 0);

  return (
    <div className="paper p-5">
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <div>
          <h3 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            What actually happened
          </h3>
          <p className="text-[12.5px] text-graphite mt-0.5">
            Every step she took on this charge, with exactly what she was given and exactly what came back.
          </p>
        </div>
        <div className="text-right text-[11.5px] text-graphite num">
          {runs.length} steps · {(ms / 1000).toFixed(1)}s
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {runs.map((r, i) => {
          const meta = WHAT_IT_DOES[r.agent] || { does: "", reads: "", decides: "" };
          const isOpen = open === i;
          return (
            <div key={i} className="border border-rule rounded-sm bg-white/60">
              <button onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left px-3 py-2.5 hover:bg-paper2/70">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className="num text-[11px] text-graphite">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[13.5px] font-semibold">{r.agent}</span>
                    {!r.ok && <Chip tone="red">failed</Chip>}
                  </span>
                  <span className="num text-[11px] text-graphite whitespace-nowrap">
                    {(r.latency_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="text-[12px] text-graphite mt-1 pl-6">{meta.does}</div>
              </button>

              {isOpen && (
                <div className="border-t border-rule px-3 py-3 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>What it was given</Label>
                      <p className="text-[12px] text-graphite">{meta.reads}</p>
                    </div>
                    <div>
                      <Label>What it decides</Label>
                      <p className="text-[12px] text-graphite">{meta.decides}</p>
                    </div>
                  </div>

                  {r.error && (
                    <div className="bg-[#F5E3E3] border border-[#E0BFBF] rounded-sm px-2.5 py-2 text-[12px] text-flagged">
                      {r.error}
                    </div>
                  )}

                  {r.system_prompt ? (
                    <>
                      <Block title="What she was asked to do" body={r.system_prompt} />
                      <Block title="What she was given, with personal data removed" body={r.input_payload} pretty />
                      <Block title="What came back" body={r.raw_output} pretty />
                    </>
                  ) : (
                    <p className="text-[12px] text-graphite">
                      Recording is switched off under Controls, so only the timings and cost were kept.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Block({ title, body, pretty }: { title: string; body: string; pretty?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!body) return null;
  let text = body;
  if (pretty) {
    try { text = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  const long = text.length > 1400;
  const shown = expanded || !long ? text : text.slice(0, 1400) + "\n…";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>{title}</Label>
        <span className="text-[10px] text-graphite num">{text.length.toLocaleString()} chars</span>
      </div>
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-paper2 border border-rule rounded-sm p-2.5 max-h-96 overflow-auto">
        {shown}
      </pre>
      {long && (
        <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-stamp mt-1 hover:underline">
          {expanded ? "Show less" : `Show all ${text.length.toLocaleString()} characters`}
        </button>
      )}
    </div>
  );
}
