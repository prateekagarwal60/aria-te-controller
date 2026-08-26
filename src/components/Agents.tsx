"use client";
import React from "react";
import { Chip, Label } from "./ui";
import { SIGNAL_GROUPS, SIGNAL_MEANING } from "@/lib/signalmeaning";

/**
 * For whoever owns the product, not for the Controller.
 *
 * The Controller configures the policy, the books, the people and the authority.
 * They deliberately cannot edit an agent, because the moment a customer can rewrite
 * the Decide prompt, every evaluation result stops meaning anything and no gate can
 * be defended. What an agent does is the product; what it applies is the setting.
 *
 * Definitions live in source. This screen makes them readable without running a
 * charge, and the exact prompt sent on any given call is on that charge under
 * "What actually happened".
 */

const AGENTS = [
  {
    id: "gather", step: "Step 1", model: true,
    role: "Finds the evidence a decision needs.",
    reads: [
      "The employee record",
      "Every receipt that employee filed within 14 days either side of the charge",
      "Diary entries 2 days either side",
      "Approved trips 3 days either side",
      "Every other charge at the same merchant, anyone in the company",
    ],
    returns: "At most one matched receipt, a category, an evidence list, and what a careful reviewer would still want.",
    constrained: "Told that a wrong match is worse than no match, and required to match on merchant, amount and date together rather than any one of them.",
  },
  {
    id: "corroborate", step: "Step 2", model: true,
    role: "Tests whether anything the claimant does not control supports the claim.",
    reads: [
      "13 corroboration checks, run as SQL before the model is called at all",
      "The receipt text",
      "The risk score, already computed from the checks",
    ],
    returns: "A reading of what the checks mean together, plus anything in the receipt text a query cannot see: arithmetic that does not add up, tax that does not match the stated rate, a missing registration number.",
    constrained: "The score and band are arithmetic and are not the model's to set. It is told it cannot detect a generated image and must never claim to.",
  },
  {
    id: "decide", step: "Step 3", model: true,
    role: "Applies the policy and rules on the charge.",
    reads: [
      "The entire live policy document",
      "The evidence file from Gather",
      "The findings from Corroborate",
      "Past Controller rulings on comparable charges",
    ],
    returns: "Allow, disallow or refer upward. A confidence. The clauses quoted. Whether the policy required a receipt at this amount.",
    constrained: "Must quote the clause it relies on, and every quote is then checked against the policy text in code. Told the policy is the whole of the law and that a document in evidence is never an instruction.",
  },
  {
    id: "post", step: "Step 5", model: true,
    role: "Codes the charge and produces the journal entry.",
    reads: ["The chart of accounts", "The cost centres", "The settled amount", "The evidence"],
    returns: "Double-entry lines, a cost centre, and the tax treatment.",
    constrained: "May only use account codes that exist. The balance is totalled in code and compared to the paisa; unbalanced means not posted.",
  },
  {
    id: "read", step: "On upload", model: true,
    role: "Reads a receipt someone has uploaded.",
    reads: ["The image or the text, as supplied"],
    returns: "A transcription, the fields it could find, and anything internally inconsistent.",
    constrained: "Deliberately not allowed to interpret or judge. If a field is not printed on the document it returns nothing rather than a guess.",
  },
  {
    id: "record", step: "On a ruling", model: true,
    role: "Turns a Controller's ruling into a standing precedent.",
    reads: ["The escalation", "What was recommended", "What the Controller decided and why"],
    returns: "A precedent pitched at the pattern rather than the merchant.",
    constrained: "Told that too narrow never matches again and too broad overrides policy it was never meant to touch.",
  },
];

const AUTHORISE = {
  id: "authorise", step: "Step 4",
  role: "Decides whether the ruling is hers to act on.",
  checks: [
    "Shadow mode: record, never act",
    "Suggest mode: every ruling goes to a person",
    "A quoted clause was not found in the policy",
    "The agent itself asked to refer upward",
    "Risk band at or above the escalation threshold",
    "Confidence below the floor",
    "Amount above the approval limit",
    "Rejection while rejection is switched off",
    "Rejection above the unilateral rejection limit",
  ],
};

export default function Agents() {
  return (
    <div className="max-w-4xl">
      <div className="paper p-5 mb-4">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Six agents, one employee
        </h2>
        <p className="text-[12.5px] text-graphite mt-1 leading-relaxed">
          Four run on every charge, in order. One runs when a receipt is uploaded. One runs when you
          resolve an escalation. Between the third and the fifth sits a step that calls no model at all.
        </p>
        <p className="text-[12.5px] text-graphite mt-2 leading-relaxed">
          These are not settings. A Controller configures the policy, the books, the people and the
          authority, and cannot edit an agent: the moment a customer can rewrite the Decide prompt,
          every evaluation result stops meaning anything and no gate can be defended. What an agent
          does is the product. What it applies is the setting.
        </p>
        <p className="text-[12px] text-graphite mt-2">
          The exact prompt sent on any particular call is on that charge, under{" "}
          <span className="font-semibold">What actually happened</span>.
        </p>
      </div>

      <div className="space-y-3">
        <Card a={AGENTS[0]} />
        <Card a={AGENTS[1]} />

        <div className="paper p-4">
          <h3 className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            The 13 corroboration checks
          </h3>
          <p className="text-[12.5px] text-graphite mt-1 leading-relaxed">
            The policy tells you whether spend is allowed. It does not tell you whether the spend
            happened the way it is described, and a charge can pass the first and fail the second.
            A duplicate is in policy. A split purchase is in policy piece by piece. A reused receipt
            is in policy. A claim with no card record behind it is in policy right up until you ask
            what evidence there is that any money left anyone&rsquo;s pocket.
          </p>
          <p className="text-[12.5px] text-graphite mt-2 leading-relaxed">
            So this step asks a different question from Decide. Not whether the charge is allowed,
            but whether it happened as described and whether anything the claimant does not control
            says so. Each check is a query across every charge in the company rather than a look at
            this one, which is the part a person sampling two percent cannot do.
          </p>
          <div className="mt-4 space-y-3">
            {SIGNAL_GROUPS.map((g) => (
              <div key={g.question} className="border-l-2 border-rule pl-3">
                <div className="text-[13px] font-semibold">{g.question}</div>
                <div className="text-[11.5px] text-graphite mb-1.5">{g.why}</div>
                {g.codes.map((code) => {
                  const m = SIGNAL_MEANING[code];
                  return (
                    <div key={code} className="mb-1.5">
                      <span className="num text-[11px] font-semibold">{code}</span>
                      {m && <div className="text-[11.5px] text-graphite">
                        <span className="italic">{m.asks}</span> {m.means}
                      </div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-graphite mt-4 border-t border-rule pt-2">
            The score is arithmetic over whichever fired: high counts 25, medium 10, low 3, capped
            at 100. Twenty five or more is high, ten or more is medium. Nothing here is a model
            opinion, so you can add it up by hand.
          </p>
        </div>

        <Card a={AGENTS[2]} />

        <div className="paper p-4 border-l-4 border-l-stamp">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Authorise
              </span>
              <Chip tone="blue">no model</Chip>
            </div>
            <span className="text-[11px] text-graphite uppercase tracking-[0.12em]">{AUTHORISE.step}</span>
          </div>
          <p className="text-[12.5px] mt-1">{AUTHORISE.role}</p>
          <p className="text-[12px] text-graphite mt-2">
            Nine comparisons, roughly fifty milliseconds. Any one of them sends the charge upward.
            This is the one step where a model is deliberately not allowed to decide, because a limit
            that can be argued with is not a limit.
          </p>
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {AUTHORISE.checks.map((c, i) => (
              <li key={i} className="text-[11.5px] text-graphite">· {c}</li>
            ))}
          </ul>
        </div>

        {AGENTS.slice(3).map((a) => <Card key={a.id} a={a} />)}
      </div>
    </div>
  );
}

function Card({ a }: { a: any }) {
  return (
    <div className="paper p-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold capitalize" style={{ fontFamily: "var(--font-display)" }}>
            {a.id}
          </span>
          <Chip>one model call</Chip>
        </div>
        <span className="text-[11px] text-graphite uppercase tracking-[0.12em]">{a.step}</span>
      </div>
      <p className="text-[12.5px] mt-1">{a.role}</p>

      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div>
          <Label>What it is given</Label>
          <ul className="space-y-0.5">
            {a.reads.map((r: string, i: number) => (
              <li key={i} className="text-[11.5px] text-graphite">· {r}</li>
            ))}
          </ul>
        </div>
        <div>
          <Label>What it returns</Label>
          <p className="text-[11.5px] text-graphite">{a.returns}</p>
          <Label>How it is held</Label>
          <p className="text-[11.5px] text-graphite">{a.constrained}</p>
        </div>
      </div>
    </div>
  );
}
