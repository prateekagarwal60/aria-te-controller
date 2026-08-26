# One charge, all the way through

Hotel Roseate Aerocity, ₹25,536, Divya Pillai, 19 August. Traced end to end so
nothing in the pipeline has to be taken on trust.

## Reading a charge in three seconds

Open any charge and the first thing on the page is six checks:

| Check | What it means | Computed from |
|---|---|---|
| **Receipt** | Was one required by this policy at this amount, and was one found | The policy's own threshold, read at decision time, plus whether a receipt matched |
| **Corroboration** | Does anything the claimant does not control place this spend | The trip record, the calendar, the card feed |
| **Amounts** | Does the receipt total match the card charge | Both numbers, compared in code, one percent tolerance |
| **Risk** | What the nine corpus checks found | The signals, not an opinion |
| **Policy** | The call, and whether the clause it rests on is real | The verdict plus the citation check |
| **Posted** | What happened to the money | The journal entry and whether it balanced |

Every one is computed from the record, not taken from the agent's account of itself.
Green means nothing needs you. Amber means read that one. The line underneath names
the first thing to look at, or says nothing needs you.

**That is the trust surface.** A Controller clearing forty charges cannot audit forty
pieces of reasoning; they can scan forty rows of six. The queue carries the same
summary, so a whole morning's work reads at a glance.

Click any check and the evidence file opens at that section.

## Seeing what it was actually given

Under the checks, **open the evidence file**. It shows the records themselves, not a
description of them: the receipt in full, every receipt candidate that was considered
and which one matched, the approved trips with their dates and whether they cover this
charge, the calendar entries, every other charge at this merchant anywhere in the
company, and each corpus check with its result.

Search windows are printed as the dates that were actually searched. "Fourteen days
either side" is not something anyone can verify. "5 Aug to 2 Sep, three candidates
found, R-2010 matched" is.

For the raw prompts and replies, the **What actually happened** tab has the exact
instruction each agent was given, the exact data sent after redaction, and the reply
before any parsing. That view is for debugging, not for clearing a queue.

---

## What the agent starts with

| | |
|---|---|
| Charge | Hotel Roseate Aerocity, INR 25,536, 19 Aug 2026, card ····5590 |
| Employee | Divya Pillai, IC3 Marketing Associate, Marketing, CC-MKT |
| In the corpus | Trip T-504 to Delhi NCR, 17 to 19 Aug, SaaSExpo booth staffing, approved by Nikhil Bose |
| | Calendar C-9006, SaaSExpo booth setup, 17 Aug |
| | Receipt R-2010, two nights at INR 11,400, CGST and SGST 2,736, GSTIN present, marked "SaaSExpo India 2026 delegate rate" |

## Step 1, Gather

**Queries first, and the windows are recorded as dates.** For this charge:

| Searched | Window | Found |
|---|---|---|
| Receipts filed by Divya Pillai | 5 Aug to 2 Sep 2026 | the candidates, with R-2010 matched |
| Calendar entries | 17 to 21 Aug 2026 | C-9006, booth setup on the 17th |
| Approved trips | 16 to 22 Aug 2026 | T-504, Delhi NCR, 17 to 19 Aug, covers this charge |
| Other charges at this merchant, anyone in the company | all time | none |

All of that is on the evidence file with the actual rows, including the receipts that
were considered and rejected.

**Then one model call.** It is asked to match at most one receipt on merchant, amount
and date **together**, and told that a wrong match is worse than no match.

**What comes back:** R-2010 matched, category accommodation, an evidence list naming
the receipt, the trip and the calendar entry, and a two sentence narrative.

## Step 2, Check

**Nine SQL queries run before the model is called at all.** On this charge:

| Signal | Fires? |
|---|---|
| Near-duplicate at the same merchant | No |
| Same-day split | No |
| Merchant unseen anywhere in the company | Yes, low severity |
| Inside an approved trip window | Yes, T-504 |
| Calendar corroboration on the date | No, the booth setup entry is on the 17th |
| Receipt amount matches the card charge | Yes, 25,536 both sides |
| Receipt content submitted before | No |
| Reimbursement with no independent record | Not applicable, this is a card charge |
| Round number | No |

**Then one model call** over those signals plus the receipt text, looking for internal
inconsistency: arithmetic that does not add up, tax that does not match the stated rate,
a missing registration number. Here the maths works and the GSTIN is present.

Risk lands low. Note what it does **not** do: it never claims the receipt image is
genuine or generated, because nothing can do that reliably. It reports what independently
corroborates the claim.

## Step 3, Decide

The largest call, and the only one that gets the whole policy document.

**Sent:** the entire live policy, the evidence file, the investigation, and any past
Controller rulings on comparable cases.

**The tension it has to resolve:** clause 4.1 caps Delhi NCR at INR 9,000 a night and
the rate is 11,400. Clause 4.2 allows the excess where the rate exceeds the cap because
of a company-sponsored event at that venue **and the event is named on the expense**. The
receipt names SaaSExpo India 2026. The exception governs, so the correct answer is to
allow it and quote 4.2.

**Then, in code with no model involved,** every quoted clause is checked against the
policy text. A paraphrase passes. A figure that is not in the document does not. A verdict
resting on an invented clause is forced upward whatever confidence was reported.

## Step 4, Authority

**No model call. Six comparisons, roughly fifty milliseconds.**

| Check | Here |
|---|---|
| Did it ask to escalate | No |
| Risk band at or above the escalation threshold | Low, below High |
| Confidence below the floor | No |
| Amount above the approval limit | 25,536 against 1,00,000, inside |
| Rejection above the unilateral rejection limit | Not a rejection |
| Any citation unverified | No |

All clear, so it acts. This step returning in milliseconds is not a skip: it is the one
place a model is deliberately not allowed to decide.

## Step 5, Post

**Sent:** the chart of accounts, the cost centres, the settled amount, the evidence.

**Comes back:** debit 6110 Travel Accommodation 22,800 to CC-MKT, debit 1310 Input Tax
Credit 2,736 (the GSTIN is on the receipt, so the tax is recoverable and is split out
rather than buried in the expense), credit 2110 Corporate Card Liability 25,536.

**Then, in code,** debits and credits are totalled and compared to the paisa. Unbalanced
means not posted, and it goes upward instead.

---

## Why it takes the time it takes

Four model calls, one code step. The policy is re-read on every charge rather than cached,
which is what makes editing a clause take effect on the next charge instead of the next
deploy. That is a deliberate trade of speed for the property the product is built on.

The per-step timings and token counts are on the pipeline strip and in the trace.

---

## When there is no receipt at all

A card charge with no receipt is not automatically a problem, and the product should not
pretend otherwise. Whether one is required is a question for the policy, not for the
agent's instincts.

The decide agent is asked to state, from the document, whether a receipt was required at
this amount and to quote the clause that says so. On the starter policy, clause 9.1
requires one at INR 2,000 or more and 9.2 says a card record alone is sufficient below
that. So the INR 477 Uber charge settles with no receipt and the Receipt check reads
"not required" in grey rather than amber.

**And then a guardrail in code:** if the policy required a receipt and none was matched,
an allowance is not the agent's to make however confident it was. The charge is referred
upward with the clause named. That is checked outside the model, because a missing receipt
is exactly the kind of thing a model talks itself out of.

## Where the receipts come from

In this build the receipt corpus is seeded text. It stands in for the forwarding inbox a
company would run, and it is honest to say so.

In production receipts arrive four ways, and all four land in the same place and are
matched the same way:

| Path | What it looks like |
|---|---|
| Forwarded email | An address such as receipts@company. The most common path, and the one the seeded corpus imitates. |
| Mobile capture | A photograph, read by the same extractor the upload button uses. That path is live in this build. |
| Vendor push | Ride hailing, airlines and hotel chains send structured receipts by API. Cleanest data, narrowest coverage. |
| Card network enrichment | Level 3 data from the network carries line detail for some merchants. No employee action at all. |

The matching logic does not care which path a receipt came from, which is why the
provenance is recorded on every receipt rather than assumed.

---

## The other intake path

Everything above starts with a card charge, where the feed is the record and the employee
does nothing.

A reimbursement is the opposite. Nobody but the claimant knows the spend happened, so the
claimant has to start it, and what they supply is the only evidence there is. The employee
screen at `/claim` exists for that case alone. It asks for six things and no coding, no
cost centre and no approval chain.

Two things then differ, and both are visible on the workpaper:

- **The corroboration step says plainly that nothing independent supports it.** The
  `NO_INDEPENDENT_RECORD` signal fires by construction, and the risk band reflects it.
- **The entry credits employee payables rather than the card liability**, because the
  company owes the employee rather than the card issuer.

Charge X-3008, Grand Meridien Banquets, is the seeded example.
