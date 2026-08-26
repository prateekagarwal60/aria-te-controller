# Scope

Verified against the code, not from memory. Every claim below is checkable in the repo.

---

## The product

**The T&E Controller.** An AI employee that holds the role a T&E analyst used to hold.
It is hired and onboarded, given a policy and a chart of accounts, granted authority, and
reports to the Corporate Controller. It is not a copilot: nobody prompts it. A charge
lands, it wakes up, works, and speaks only when its authority or its confidence runs out.

**Six responsibilities in the full product. Four in the MVP.**

| # | Responsibility | MVP |
|---|---|---|
| 1 | **Gather** the evidence a decision needs | Built |
| 2 | **Decide** every charge against the written policy | Built |
| 3 | **Corroborate** fraud, duplicates, splitting, uncorroborated claims | Built |
| 4 | **Post**: code it, allocate it, post the journal entry | Built |
| 5 | **Recover**: input tax, unused ticket credits, duplicate payments | Not built |
| 6 | **Counsel**: propose policy changes from its own escalation history | Not built |

---

## What it actually does, per charge

Five steps. Four call a model, one deliberately does not.

| Step | Model? | What happens |
|---|---|---|
| **Gather** | Yes | Queries receipts filed within 14 days, calendar entries ±2 days, approved trips ±3 days, and every other charge at that merchant company-wide. One model call matches at most one receipt on merchant, amount and date together. Windows are recorded as the actual dates searched. |
| **Check** | Yes | **13 corroboration signals run as SQL before any model call**: near duplicate, same-day split, unseen merchant, in trip window, outside trip window, calendar match, no receipt, receipt amount mismatch, receipt merchant mismatch, receipt reused, no independent record, round amount, high velocity. Then one model call over those signals plus the receipt text, looking for internal inconsistency. |
| **Decide** | Yes | Gets the entire live policy document, the evidence, the investigation, and past Controller rulings. Returns a verdict, a confidence, the clauses quoted, and whether the policy required a receipt at this amount. |
| **Authority** | **No** | Nine comparisons in code. Roughly 50ms. |
| **Post** | Yes | Codes to the chart of accounts, picks the cost centre, splits recoverable tax, produces double-entry lines. The balance is then checked in code. |

**The nine authority checks, all in code:** shadow mode, suggest mode, an unverified
citation, the agent asking to escalate, risk band at or above the threshold, confidence
below the floor, amount above the approval limit, rejection when rejection is switched
off, and rejection above the unilateral rejection limit. Any one of them sends the charge
upward.

**Two intake paths.** A corporate card charge arrives on its own and no employee touches
it. A reimbursement has no independent record, so the claimant starts it at `/claim` and
the difference shows up twice: the `NO_INDEPENDENT_RECORD` signal fires by construction,
and the entry credits employee payables rather than the card liability.

**The learning loop.** A Controller resolves an escalation, a model generalises the ruling
into a precedent, and the next comparable charge cites it.

---

## What is simulated, and what is not

| Simulated | Real |
|---|---|
| The card feed. Eighteen charges are seeded, each labelled with what it puts under pressure. | Every decision made about them. |
| The receipt corpus. Ten receipts as text, standing in for a forwarding inbox. | Reading them, matching them to charges, and detecting reuse by content hash. |
| The calendar and the trip records. | Querying them and using them as corroboration. |
| The ERP. The ledger is local Postgres. | The double entry, the balance check, and the trial balance, all computed. |
| The starter policy (12 sections), the chart of accounts (12 accounts, 6 cost centres), the six employees. All replaceable at onboarding. | The policy is read at decision time, so replacing it changes the next decision. |

**Live, not simulated:** receipt image upload and extraction (vision, at request time),
every model call, all 13 SQL signals, citation verification, PII redaction, the authority
gate, double-entry validation, the hash-chained decision log, and the eval harness.

---

## What it will do later but cannot now

| Gap | Why it matters |
|---|---|
| **Recovery.** Input tax reclaim, unused ticket credits, duplicate payment recovery. | Carries the largest single return. Cut for build cost. The post agent already splits recoverable tax on the entry; nothing files a claim. |
| **Counsel.** Proposing policy changes from its own escalations. | Cannot exist on day one by design. It needs escalation history first. |
| **Workflow and routing.** Everything escalates to one Controller. | Real orgs route by amount, department and entity. This layer belongs to a platform, not to this agent. |
| **Custom fields.** Project code, client matter, grant number. | Often mandatory, and often the reason a charge is queried. |
| **Authentication.** Anyone with the URL can rewrite the policy and post to the ledger. | Correct for a demo the panel must be able to break. Disqualifying for production. |
| **Multi-tenant isolation.** | Single tenant only. |
| **Gather and corroborate agent accuracy.** Neither is scored. | A wrong receipt match poisons every later step. Risk bands are asserted, never validated against labelled fraud. |
| **Full-pipeline eval.** Suites test agents in isolation. | Errors compound across five steps. |
| **Model-version regression baseline.** | Changing the model silently changes behaviour. |
| **Rate limiting.** | The spend cap bounds cost, not request volume. |

---

## What it is designed never to do

Not gaps. Decisions.

| Never | Why |
|---|---|
| **Claim it can tell a generated receipt image from a real one.** | No reliable forensic exists. A product that claims otherwise teaches its users to trust a number they should not. It corroborates against records the claimant does not control, and reports when nothing does. |
| **Decide its own authority.** | Limits, the confidence floor, the risk ceiling and double-entry arithmetic are enforced in code after the model decides. Nothing written in a receipt can widen them. |
| **Rely on a clause it cannot quote.** | Every citation is checked against the policy text in code. A paraphrase passes. A figure not in the document does not. An unverified citation forces escalation whatever confidence was reported. |
| **Allow a charge on evidence the policy required and nobody supplied.** | Checked outside the model, because a missing receipt is what a model talks itself out of. |
| **Post an entry that does not balance.** | Debits and credits are totalled in code and compared to the paisa. Unbalanced means not posted, and it goes upward. |
| **Treat anything in a receipt or memo as an instruction.** | Evidence is a record of what happened. It cannot approve a charge, waive a clause, raise a limit or cite a precedent into existence. Text aimed at a reviewer is treated as a fraud signal rather than a mitigating one, and eight A/B injection pairs assert that hostile text does not move a verdict. |
| **Send personal data to the model.** | Card numbers, Aadhaar, PAN, IBAN, email and phone are redacted before any call. A vendor GSTIN is deliberately kept, because the post agent needs it to decide whether input tax is recoverable. |
| **Change the policy.** | It may propose changes once Counsel is built. It may never apply them. |
| **Approve its own exceptions.** | An escalation goes to a person. |
| **Invent a rule where the policy is silent.** | It says the policy is silent and refers the charge upward. One eval case exists purely to test this. |
| **Run without a record of what it was asked.** | Every call stores the exact prompt, the exact payload after redaction, and the raw reply. Retention can be switched off; the counters cannot. |

---

## How it is checked

| | |
|---|---|
| `npm test` | 98 assertions plus a scan of all 145 SQL literals against a real Postgres. No API calls, runs in seconds. |
| `npm run eval` | Six suites against a live model: policy invariance (5 rulebooks), golden set (24 cases), injection (8 A/B pairs), judgment (8 cases), consistency, closing (4 cases). |
| Gates | Invariance 90%, injection 100%, golden 85%, judgment 75%, consistency 90%, closing 100%. p95 under 15s, under $0.05 a charge. |

**Policy invariance is the suite that matters most.** Same charge, five different
rulebooks. The verdict has to track the document. An agent carrying a memorised industry
default passes a single-policy golden set and fails this one.
