# One name per thing

Four sets of names, because there are four different kinds of thing. Within a set
nothing repeats, and across sets nothing collides. Every one of these is used in the
interface, in the code, in the work log and in these documents, with no synonyms.

---

## The five steps a charge goes through

| Step | Model? | What it does |
|---|---|---|
| **Gather** | yes | Finds the receipt, the trip, the diary entry, the merchant history |
| **Corroborate** | yes | Tests the claim against 13 checks over every charge in the corpus |
| **Decide** | yes | Reads the policy, rules, quotes the clause |
| **Authorise** | **no** | Nine comparisons in code. Is this hers to act on |
| **Post** | yes | Codes it and writes the journal entry |

## The six agents

Four are the model-calling steps above and carry the same names. Two run outside the
pipeline.

| Agent | When |
|---|---|
| `gather` | Step 1 |
| `corroborate` | Step 2 |
| `decide` | Step 3 |
| `post` | Step 5 |
| `read` | When a receipt is uploaded |
| `record` | When you resolve an escalation |

Authorise is not an agent. It calls no model, which is the point of it.

## The six checks on the checklist

What you scan at the top of a charge. Each is computed from the record, not taken from
the agent's account of itself.

| Check | Asks |
|---|---|
| **Receipt** | Was one required by this policy at this amount, and was one found |
| **Corroboration** | Does anything the claimant does not control place this spend |
| **Amounts** | Does the receipt total match the card charge |
| **Risk** | What the 13 corroboration checks found, scored |
| **Clause** | Does the clause the decision rests on exist in the policy |
| **Posted** | What happened to the money |

## The screens

| Screen | For |
|---|---|
| **Queue** | The charges and their state |
| **Escalations** | Charges waiting on a human decision |
| **Ledger** | Entries posted, and the trial balance |
| **Policy** | The document she applies, and its versions |
| **Precedents** | Decisions of yours, generalised, that she now applies herself |
| **Evaluation** | The golden set, and where the product suites live |
| **Controls** | Mode, stop, spend cap, audit chain, what the guardrails caught |
| **Authority** | The limits Authorise enforces |
| **Manual entry** | Put a charge on the queue by hand |
| **Agents** | The six definitions, read only |

---

## Deliberate near-collisions

Two pairs look alike on purpose, because the relationship is real.

**Authority** the screen sets the limits that **Authorise** the step enforces. One is
where you set them, the other is where they bite.

**Corroborate** the step produces the **Corroboration** check. One is the work, the
other is the result you scan.

## Names that were dropped

| Was | Now | Why |
|---|---|---|
| assembler | gather | Two names for one thing: the interface said Gather, the work log said assembler |
| investigator | corroborate | Same problem, and "investigate" overstates what it does |
| adjudicator, Apply policy | decide | "Adjudicate" is standard in insurance claims, not in expenses |
| closer | post | Post says what happens; close is what happens to a month |
| extractor | read | |
| precedent (the agent) | record | "Precedent" is the thing produced, not the act |
| Policy (the check) | Clause | Collided with the Policy screen. The check is about whether the cited clause exists |
| Desk | Queue | Invented. Queue is plain and standard. |
| Needs you | Escalations | Over-corrected. "Escalation" is a real term a Controller uses daily and did not need replacing. |
| Rulings | Precedents | Same. It is also what the underlying table is called. |
| Add a charge | Manual entry | What the function is called in every accounts payable system. |
| Referred upward | Escalation | The standard term in finance operations |
| Exhibits | evidence file | It was the model's prose about its inputs. Now it is the records |
| Terms of employment | Authority | Kept as the panel heading, where there is room to explain it |

---

## Reference prefixes

| | |
|---|---|
| `X-` | a card charge |
| `CASE-` | the work item opened for a charge |
| `R-` | a receipt |
| `T-` | an approved trip |
| `C-` | a diary entry |
| `E-` | a person |
| `JE-` | a journal entry |

In production these are the identifiers the source systems already carry: the card feed's
transaction id, the travel booking reference, the message id of a forwarded receipt. Here
they are seeded, which is why they look tidy.

---

## How the risk score is arrived at

Not a number a model picks. Arithmetic over the checks that fired, so a reviewer can add
it up by hand.

| Severity | Points |
|---|---|
| high | 25 |
| medium | 10 |
| low | 3 |
| info | 0 |

Capped at 100. Twenty five or more is **high**, ten or more is **medium**, below that
**low**. Three weak checks come to 9 and stay low; four come to 12 and reach medium.

**What you do with the number: nothing.** The band is what acts, through the escalation
threshold you set under Authority. The score is there so the band is explainable and so a
queue can be sorted by it.

---

## Why the Corroborate step exists at all

The policy tells you whether spend is **allowed**. It does not tell you whether the spend
**happened the way it is described**. A charge can pass the first and fail the second: a
duplicate is in policy, a split purchase is in policy piece by piece, a reused receipt is in
policy, and a claim with no card record behind it is in policy right up until you ask what
evidence there is that any money left anyone's pocket.

So Corroborate asks a different question from Decide. Not "is this allowed" but "did this
happen as described, and does anything the claimant does not control say so".

Every check is a query across the whole corpus rather than a look at the one charge. That
is the part a person sampling two percent cannot do, and it is why several of them mean
nothing on a single charge and a great deal at volume.

| The question | Checks | Why it matters |
|---|---|---|
| Is this the same spend twice? | `NEAR_DUPLICATE`, `RECEIPT_REUSED` | The most common finding in any expense audit, and most are honest |
| Was one purchase broken into pieces? | `SAME_DAY_SPLIT` | Splitting to clear an approval limit is usually a violation in itself |
| Is there any evidence the spend happened? | `NO_INDEPENDENT_RECORD`, `NO_RECEIPT` | The question a generated receipt cannot answer |
| Does the paperwork agree with the money? | `RECEIPT_AMOUNT_MISMATCH`, `RECEIPT_MERCHANT_MISMATCH` | Where the document and the feed disagree, one is wrong |
| Does anything place this person there? | `IN_TRIP_WINDOW`, `OUTSIDE_TRIP_WINDOW`, `CALENDAR_MATCH` | Records made before the spend, usually by other people |
| Is this normal for this company? | `UNSEEN_MERCHANT`, `HIGH_VELOCITY`, `ROUND_AMOUNT` | Worth almost nothing alone, meaningful against everyone else's |

The full text of each, with what it asks and what it means, is on the **Agents** screen and
inline on any charge where one fired.

## Two ways of testing, and what each covers

| | `npm test` | `npm run eval` |
|---|---|---|
| Tests | Things with exactly one right answer | Judgment, which has none |
| Calls a model | No | Yes |
| Takes | Seconds | Minutes |
| Costs | Nothing | A few cents |
| Covers | See below | Policy invariance, the golden set, injection, judgment, consistency, closing |
| Result | Pass or fail | Rates against gates |

`npm test` prints what it covered when it finishes. In full:

| Suite | What it asserts |
|---|---|
| `sqlcheck` | Every query shape the app sends, against a real Postgres. Includes the exact parameterised day windows, because a literal carries its type and a parameter does not. |
| `sqlscan` | All 145 SQL literals extracted from source and executed. Catches a query that typechecks, builds, and only fails when Postgres resolves an operator at run time. |
| `json` | Pulling a JSON object out of a model reply: fenced, with a preamble, with a trailing sentence, with braces inside quoted policy text. And returning nothing rather than guessing when there is nothing there. |
| `hints` | The health check maps a real error string to the right cause. An earlier version matched the bare word "model" and reported a wrong model name for a temperature error. |
| `guardrails` | PII redaction across cards, Aadhaar, PAN, IBAN, email and phone, and the vendor GSTIN deliberately kept. Citation verification including that an altered figure is rejected. The hash chain including that editing, reordering or deleting an entry breaks it. |
| `trust` | Every state of the six checks, and the risk arithmetic including its boundaries. |
| `invariance` | That the policy-invariance matrix discriminates. A matrix where every rulebook expects the same verdict proves nothing and fails here. |
| `bootstrap` | The onboarding round trip: saved policy, books and people come back in the shape the forms render. Replace replaces. Not hired until commit. |
| `paths` | Card charge and reimbursement differ in evidence and in accounting treatment, in the data rather than only in the prose. |

The Evaluation screen runs the golden set, because that is a **customer** eval: one
policy, one answer key, run during onboarding and whenever the policy changes.

The other five are **product** evals. They test the machinery rather than any one policy,
so they belong to whoever builds this and run before a release. They are on the command
line because a Controller has no reason to run them. The Evaluation screen lists all six
with their gates and the command.
