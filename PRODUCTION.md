# Making a probabilistic employee fit to hold a role

Building the agent is the easy half. This is the other half, and it is the half
that decides whether anyone lets it near real money.

The argument in one line: **you cannot test a probabilistic system into safety, so
you bound it, measure it, and roll it out in rungs.**

---

## Five questions it has to answer

| | Question | How it is answered here |
|---|---|---|
| 1 | **Can it be measured?** | Five eval suites with gates. Golden set, adversarial injection, judgment cases, run-to-run consistency, ledger correctness. `EVALS.md`. |
| 2 | **Can it be bounded?** | Approval and rejection limits, a confidence floor, a risk-band ceiling, a daily cap on its own inference spend, and a stop button. All enforced in code after the model decides. |
| 3 | **Can it be audited?** | Every decision renders as a workpaper with quoted clauses. Every quote is verified against the policy text. Every act is appended to a hash-chained log. |
| 4 | **Can it be attacked?** | Receipt text is untrusted input. Eight A/B injection pairs assert that hostile text does not move a verdict. PII is redacted before the model sees anything. |
| 5 | **Can it be rolled back?** | Versioned policy, reversible decisions, and three deployment rungs starting with shadow. |

---

## The rungs

Nobody should switch this on. You climb.

| Rung | What it does | What you learn | Move up when |
|---|---|---|---|
| **Shadow** | Decides and records. Never acts. | How often it agrees with the humans doing the same work today, on live volume rather than a golden set. | Agreement holds for a full close cycle and the disagreements are ones you would defend. |
| **Suggest** | Every decision goes to a person with reasoning attached. | Whether reviewers accept its calls, and where they overturn. Overturns become precedents. | Acceptance is high and stable across reviewers, not just the friendly one. |
| **Autonomous, narrow** | Acts inside a deliberately small limit. Everything else escalates. | Whether autonomy holds when nobody is watching each case. | Error rate inside the limit stays flat as volume grows. |
| **Autonomous, widened** | Limit raised on evidence, category by category. | | Evals still pass at the new limit. |

The mode is a setting in the Governance tab, not a deploy. That matters: the way you
stop a bad rollout is a switch, not a release.

---

## Guardrails, and where each one sits

Prompt instructions are the weakest layer. Anything that can be argued with belongs
somewhere else.

| Guardrail | Layer | Why there |
|---|---|---|
| Approval and rejection limits | Code, after the model | No amount of persuasion in a receipt can widen a number held outside the model. |
| Double-entry balance check | Code | Arithmetic is not an opinion. An unbalanced entry is refused and escalated. |
| Citation verification | Code | Requiring a quote is worthless unless something checks the quote is real. Every figure in a quoted clause must appear in the policy: rewording is fair, changing a number is the attack. |
| PII redaction | Code, before the model | Card numbers, tax identifiers, personal email and phone are removed on the way out. The originals stay in the database, so the audit trail is complete while the model context is not. |
| Daily spend cap | Code | An agent that loops is an agent with an unbounded bill. |
| Stop button | Code | The only guardrail that works when all the others have failed. |
| Injection resistance | Prompt, tested adversarially | Cannot be enforced deterministically, so it is measured instead. The eval is the control. |
| Escalation on low confidence | Code, reading a model output | The model reports confidence; the threshold is not its to choose. |

**On PII, one deliberate exception.** A vendor GSTIN is a business registration, not
personal data, and the post agent needs it to decide whether input tax is recoverable. It is
held out of redaction on purpose. Redacting everything is easy and makes the product
worse; knowing which identifier does what is the actual work.

**On injection, one deliberate non-exception.** Hostile text is *not* stripped before the
model sees it. It has to arrive so the corroborate agent can flag it as a fraud signal in its
own right. A genuine receipt records a transaction. It does not assert that the spend is
pre-approved. Text aimed at a reviewer rather than a customer raises suspicion rather than
settling it, and that only works if the text gets through.

---

## What is measured once it is live

| Metric | Why it is the one that matters |
|---|---|
| Touchless rate | The efficiency claim, and the only one finance cares about |
| Escalation precision | An agent that refers everything upward is a filter, not an employee |
| Overturn rate on escalations | If humans reverse it often, the confidence floor is wrong |
| **Allowed-when-it-should-have-disallowed** | Money out the door. Tracked separately from overall accuracy because it is a different kind of failure. |
| Confidence calibration | A confidence number is only useful if it tracks how often it is right |
| Cost per charge, p95 latency | An agent with an unbounded bill does not ship |
| Chain integrity | Continuous. A broken hash chain is an incident, not a metric. |

---

## Honest gaps

Naming these is stronger than claiming coverage that is not there.

| Gap | Consequence |
|---|---|
| **No authentication.** Anyone with the URL can rewrite the policy and post to the ledger. | Deliberate for a demo the panel must be able to break. Disqualifying for production. First thing to build. |
| No tenant isolation | Single tenant only. Multi-tenant needs row-level security and per-tenant keys. |
| ~~Gather matching is never scored~~ | **Now scored** against the ten hand-written receipt-to-charge pairs in the corpus. A wrong match fails the suite outright, because it poisons every step after it. |
| Corroborate has no labelled fraud set | Its thirteen checks are asserted in `npm test` and it now runs inside the end-to-end suite, but the risk bands have never been validated against known outcomes. There is no labelled fraud to validate against. |
| Read and record are unscored | Reading a receipt image needs a labelled image set. Precedent quality is a judgement nobody has written a key for. |
| ~~No full-pipeline eval~~ | **Now run.** Six charges through all five steps against the real database, so compounding error is measured rather than assumed. |
| No model-version regression baseline | Changing the model silently changes behaviour. |
| Rate limiting is absent | The spend cap bounds cost but not request volume. |
| Human review of the golden key is pending | The answer key and the policy were written together, which measures self-consistency rather than correctness. |
