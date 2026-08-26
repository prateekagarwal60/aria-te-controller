# How this is tested

An expense agent is not testable the way a compiler is. The same input can produce
different output, and "correct" is a judgment call rather than an exact value. So
assertion is replaced by measurement over a distribution, and pass/fail by gates.

Three layers, tested differently.

---

## Layer 1: the deterministic parts

Authority limits, double-entry arithmetic, content hashing, and every SQL query are
ordinary software and are asserted exactly.

```bash
npm test        # 83 query checks + seed corpus assertions, against a real Postgres
```

This layer is deliberately large. Authority limits and balance checks are enforced in
application code precisely so that they are testable this way. Anything a model could
be talked out of does not belong here.

## Layer 2: judgment

```bash
npm run eval                    # all suites
npm run eval -- golden          # one suite
npm run eval -- --repeat 5 --suite consistency
```

Requires `DATABASE_URL`, `ANTHROPIC_API_KEY`, Node 20.6 or later, and a bootstrapped
database. Every suite calls the same agent functions the application calls. An eval that
reimplements the prompt tests a copy of the system and will pass while production fails.

| Suite | What it measures | Gate |
|---|---|---|
| `golden` | Agreement with a hand-written answer key across 24 charges | 85% |
| `injection` | Whether hostile text in a receipt or memo moves the verdict | 100% |
| `judgment` | Agreement on 8 cases with no comfortable answer | 75% |
| `consistency` | Modal verdict share across repeated runs of the same charge | 90% |
| `closing` | Entries that balance and use only real accounts | 100% |

Latency gate p95 under 15s. Cost gate under $0.05 per charge.

### Why the headline accuracy number is the least interesting one

The golden suite reports two figures underneath it:

- how often it **allowed something that should have been disallowed**
- how often it **escalated a case it should have decided**

These are different failures. The first is money out the door. The second is an agent
that refers everything upward, which is not an employee, it is a filter. A run at 90%
agreement that is failing in the first direction is worse than one at 84% failing in the
second. Read the breakdown, not the headline.

### On the answer key

The 24 golden verdicts and the policy they are scored against were written together.
That is a real weakness: it measures self-consistency rather than correctness. **Read all
24 in `src/lib/seed.ts` and change any you disagree with.** Twenty minutes, and afterwards
the provenance is defensible: a person read the policy and wrote the expected verdicts.

The `judgment` suite is separate for the same reason. It contains cases where the honest
answer is uncomfortable: policy silent on the category, a charge one rupee either side of
a cap, two clauses pointing opposite ways, evidence contradicting the memo. It also
contains one case where **escalating is the failure**, because an agent that refers a
340 rupee courier charge upward has not understood the job.

## Layer 3: adversarial

Receipt text reaches the decide agent's context. Anyone who can submit an expense can put
text in there. The injection suite runs eight A/B pairs: the same charge twice, once clean
and once with hostile text appended to a field the claimant controls.

The assertion is not "did it approve". It is **did the injected text move the verdict**.
That framing survives a policy change, which a fixed expected-verdict would not.

Attacks covered: fake system instruction, invented policy clause, fabricated Controller
precedent, authority manipulation in the memo, role-play framing, urgency and social
pressure, confidence manipulation, and context stuffing.

Both the decide agent and the corroborate agent are instructed that evidence is a record of what
happened and never an instruction, and that text aimed at a reviewer rather than a customer
is itself a fraud signal rather than a mitigating one.

---

## What is not tested yet, and should be before anyone calls this production

| Gap | Why it matters |
|---|---|
| Gather accuracy | Receipt-to-charge matching is never scored. A wrong match poisons every step after it. |
| Corroborate precision and recall | Risk bands are never checked against labelled fraud. |
| Full pipeline end to end | Suites test agents in isolation. Errors compound across five steps. |
| Model version drift | No regression baseline. Changing the model silently changes behaviour. |
| Policy regression | Editing the policy should re-run the whole suite automatically. |
| Cost under load | Measured per call, never at volume. |
| Multi-tenant isolation | Single tenant only. |

Each is real work. None is hidden.

---

## The runs, and what each one found

### First run: a bug in the harness, not in the model

Injection, consistency and closing passed. Invariance came in at 25%, the golden set at
41.7%, judgment at 62.5%.

Every failure had the same shape: the verdict came back `ESCALATE` while the reasoning
plainly decided the case. On the charge that should simply have been allowed it said
*"the room rate of INR 8,000 is within the cap, an itemised receipt was supplied, the
charge is fully compliant"* and returned `ESCALATE`.

The evidence guardrail reads `assembled.file.matched_receipt` and forces escalation when
the policy requires a receipt and none was matched. The harness built its `assembled`
object by hand and never included `file`, so a receipt that was plainly supplied read as
missing. Every allowance above the 2,000 receipt threshold was escalated by the product's
own guardrail. Of the seven golden cases expecting `APPROVE`, six are above the threshold
and all six failed. The one below it passed.

**This is the exact failure this document warns about.** An eval that does not construct
what production constructs is testing something else. The prompt was shared; the input
shape was not.

Fixed with one builder, `emptyEvidenceFile()`, used by both; a guardrail that now throws
on an evidence file with no `file` key rather than escalating quietly; and a `harness`
suite asserting every caller of Decide builds it the shared way.

### Second run: the scorer was lying about the thing that matters most

Invariance went to 100% and every rulebook comparison tracked. Judgment reached its gate.
The golden set rose to 66.7% and the failure direction flipped: zero over-escalations, and
**five charges reported as "approved something that should be disallowed"**. All five were
partial allowances: 9,000 of a 9,400 hotel, 6,000 of a 7,600 team lunch, the stay without
the minibar, the rental without the fuel upgrade, the meal with the tip trimmed to 15%.

Every one is the right answer and is what a Controller actually does. The scorer read
`verdict: APPROVE` and discarded `amount_disallowed`. That was the single most alarming
figure in the run and it was false.

**The schema was wrong, not the agent.** There are four outcomes: allow in full, allow in
part, refuse, refer upward. Six golden keys became `PARTIAL`, and "unsafe" now counts only
a charge allowed in full that should not have been paid at all.

Also found: a hole in the policy where clause 3.4 set a booking rule and no remedy;
truncation reported as a parsing fault; cost hardcoded to zero; and a crash after every
call had completed, on a variable renamed three edits earlier.

### Third run: 87.5% on the golden set, recorded as a failure

The golden set passed at **87.5%** against an 85% gate with **zero charges allowed in full
that should not have been paid**. Injection 100%, judgment 75%, closing 100%, both latency
gates met, and cost tracking working at $2.65 for 86 calls.

Then it printed `golden stopped: partialInstead is not defined`, the suite was recorded as
a failure, and the report said `NaN%`.

**Two consecutive runs completed every model call and then threw on a variable that was
used but never declared.** Both were spelled correctly, both typechecked, both cost real
money before failing. TypeScript does not see these files, and a test that never executes
the branch cannot catch it.

A linter reads every branch without running any of it. `no-undef` found both in under a
second. `npm run lint` now gates `npm test` and `npm run eval`, and the eval report no
longer prints `NaN` when a suite fails to produce a number: it names what did not finish.

### What the third run found that was real

**Three invariance misses were the same schema lag.** Under a 9,000 cap a 9,400 charge came
back `PARTIAL`, and the matrix predated `PARTIAL` so it expected `REJECT`. Allowing to the
cap is not a refusal. The matrix now expects `PARTIAL`, and a minibar-only charge was added
so it exercises a genuine outright refusal rather than only cap arithmetic.

**One invariance miss was my variant being incomplete.** On the policy silent about
accommodation, the agent allowed the charge, reasoning that no lodging rule exists and the
receipt requirement is met, so nothing in the text disallows it. Correct, given the
document. The full starter policy says "where this policy is silent, ask before you spend",
and the cut-down variant had dropped that clause. Restored.

**Two golden cases were ambiguous as written.**

The spouse ticket gave the agent two passengers sharing a surname and expected `REJECT`
under the family-member clause. Refusing to infer a family relationship from a surname is
right rather than over-cautious, and a case expecting a refusal must supply evidence the
clause applies. The booking now says so.

The client meal said "Business lunch, covers 4", which is a compliant team meal under 6.2,
and that is what the agent called it. Nothing in the case made it a client meal, so 6.1
never came into play and the case tested nothing it was written for.

Both are case-construction errors. **This is different from grading to the answer**, and
the difference is that in each one the policy plainly supports the model's reading and the
case failed to describe the situation it claimed to describe.

### The finding that is not a test problem

Consistency at 80% on a settled case. The clean economy flight came back `APPROVE,
ESCALATE, APPROVE, APPROVE, APPROVE` across five runs, with confidence spread 0.23.

Nothing is wrong with the case, the key or the scorer. One run in five referred a
straightforward charge upward, and that is real behaviour worth knowing about. Escalation
is the safe direction, so it does not risk money, but a fifth of clean charges arriving on
the Controller's desk would undo most of the touchless claim.

**The gate stays where it is.** This is the one number in the suite that is telling the
truth about the system rather than about the test, and moving a gate to accommodate it
would be the exact corruption this document warns against everywhere else.

What it points at, in order of likelihood: the case sits near a decision boundary the
prompt does not resolve; five runs is too few to estimate a rate; or the Decide step is
being asked for enough at once that its confidence genuinely varies. The next thing to do
is raise the repeat count and measure the rate properly before changing anything.

### Fifth run: the verdict fix landed

| Suite | Result | Gate | |
|---|---|---|---|
| Policy invariance | 100% | 90% | pass |
| Golden set | 91.7%, or 95.5% setting aside one registered disagreement | 85% | pass |
| Injection | 100% | 100% | pass |
| Judgment | 75% | 75% | pass |
| Closing | 100% | 100% | pass |
| Consistency | 80% | 90% | fail |

**Charges allowed in full that should not have been paid: zero**, as on every previous run.

Invariance went from oscillating between 25 and 100 across four runs to 100 with every one
of eighteen cases correct. The two cases that had flipped between `PARTIAL` and `REJECT`
on identical reasoning both settled. That was the verdict fix and nothing else.

### The consistency gate was not measurable

One suite still failed, so the rate was measured properly: fifteen runs of each charge
instead of five.

| | clean economy flight |
|---|---|
| Five runs | four `APPROVE`, one `ESCALATE`, 80% |
| Fifteen runs | fifteen `APPROVE`, 100% |
| Pooled | 19 of 20, 95% |

At five runs the only readings available are 100%, 80%, 60% and so on. **A gate of 90% sits
in the gap between the first two.** There is no observation equal to 90%, so the suite could
only ever read PASS at 100% or FAIL at 80%, and a true rate near 95% lands on one or the
other at random. Both happened.

That is a measurement error of mine, not behaviour of the agent. Two changes:

The gate now applies only when the sample can resolve it, which for 90% means ten runs or
more. Below that the suite reports and says why it is not gating.

Every reading carries a Wilson interval, so `19/20` prints as 95% with a 95% interval of
76% to 99% rather than as a number pretending to be exact.

**This is worth generalising.** A gate you cannot resolve at your sample size is not a gate,
it is a coin toss with a threshold drawn on it. The same arithmetic applies to any rate
measured on a handful of runs.

### One hard failure in a hundred and twenty one calls

A judgment case returned `could not read a JSON object out of the reply`, and the first two
hundred characters printed with the error showed well-formed JSON. Not truncation: the
object had closed, and the error message correctly said so.

The cause is a raw newline inside a string value, which is invalid JSON and which models
emit. Escaping control characters that sit inside a string literal repairs exactly that and
touches nothing else, because the walk already knows when it is inside a string.

Seven cases added, including that a repair must **not** rescue a truncated object, since
truncation is a different failure and has to stay distinguishable.

### Latency

p50 12.7s inside its gate. p95 41.5s against a 40s gate, a marginal miss on 121 calls that
included at least one retry. A call sent twice takes roughly twice as long, so p95 over
first attempts is now reported separately: a mixed p95 tells you about the retries rather
than about the model.

### Two more disagreements registered, neither resolved

`Spouse ticket on the same booking` splits the fare evenly and allows the employee's half.
Clause 10.1 bars spend for a family member and says nothing about voiding the employee's own
ticket, so a split is defensible and arguably better than the key. The key stands at REJECT
because inventing a 50/50 split on a single booking with no per-passenger breakdown is an
assumption a Controller should make rather than the agent. The honest reading is that this
case has two right answers and the key picked one.

`Two clauses point opposite ways` came back `PARTIAL` because clause 4.2 exempts a
**company-sponsored** event and SaaSExpo is a third-party trade expo. That is a correct
reading of the clause as written, and the same charge passed as `APPROVE` in the golden set
in the same run, which means the ambiguity is in the policy rather than in the agent.
Recorded and not edited, because the key is frozen and because the fix belongs in clause
4.2 rather than in the answer.

### Three gates were declared and never enforced

`cost_per_charge_usd` was referenced nowhere at all. Both latency gates printed a verdict
and were then left out of the tally, so run five printed `p95 41563ms FAIL` and, four lines
later, `1 suite(s) below gate: consistency`.

All three are enforced now and the summary counts gates rather than suites. The cost gate
measures the per-call figure, which is what the suites exercise, and the per-charge estimate
is printed with its four-call multiplier shown rather than implied.

The default repeat moved from five to ten for the same reason: a suite that cannot fail on
the default command is decoration.

One arithmetic bug came out of that change. `1/(1-0.9)` is `10.000000000000002` in floating
point, so a bare `Math.ceil` returns eleven, and the consistency gate would have needed
eleven runs while the default was ten. It would have reported forever without ever gating.

### Measuring a rate rather than reading one

```
npm run eval -- consistency --repeat 15
```

Sixty calls, about two dollars. Anything under ten runs will now say plainly that it cannot
gate a 90% threshold.

### The consistency case was measuring the wrong thing

Fifteen runs of the clean economy flight came back eleven `APPROVE` and four `ESCALATE`,
with a confidence spread of 0.50. An earlier fifteen-run pass had been fifteen out of
fifteen, so something had changed.

The case was an air ticket, and clause 2.1 requires written trip approval for any air
ticket. The harness hands the agent no approved trips at all. So on that charge it was
genuinely caught between "economy is standard and the receipt is here" and "2.1 needs an
approval I cannot see", and it landed on either side depending on the run.

**That is a case defect, not drift.** The suite exists to measure whether an unambiguous
charge gets the same answer twice, so the charge has to be unambiguous. The approval is now
stated on it.

The distinction that matters, and the one being applied consistently: a key is not changed
because the model disagreed, and a case is fixed when it fails to describe the situation it
claims to describe. Clause 2.1 is in the document and the case ignored it.

### Refusing to decide now needs a named ground

`cannot_decide` was a bare boolean, and a boolean costs nothing to set. It is now one of
four grounds, named:

| | |
|---|---|
| `no rule` | the policy contains no rule covering this kind of spend |
| `clauses conflict` | two clauses point opposite ways and neither plainly governs |
| `evidence contradicts` | the records disagree about what happened |
| `figure missing` | a number a rule needs is nowhere in the record |

Nothing else qualifies, and the prompt says so: an answer you dislike, a large amount, a
charge that will annoy someone, none of those stop you deciding.

A refusal without one of the four is still honoured, because overriding a refusal to decide
is the dangerous direction. It is recorded as `undeclared_hedge` so the rate is visible
rather than invisible.

### The third crash after a completed run

`budgetGates` was used ten lines above its declaration. The two earlier crashes were
undeclared names, which `no-undef` catches. This one is declared, so `no-undef` sees nothing
wrong: the name exists and only the order is bad.

`no-use-before-define` is now on. It found it in under a second, and both the declaration
order and the enforcement of every declared gate are asserted.

### The gather suite found a real bug on its first run

Five of ten receipts matched. Zero matched the wrong charge; five declined to match at all.

| matched | 12, 13, 14, 17, 19 August |
|---|---|
| **no match** | **02, 04, 05, 06, 06 August** |

A clean split by date, which is never a model behaving badly.

**The search filtered on `created_at`, the moment the row was written to the database,
not the date printed on the receipt.** The corpus had been seeded a few days earlier, so
every charge more than fourteen days before that seeding fell outside the window.

It is not a demo artefact. In production it means an employee who uploads a receipt three
weeks after a trip gets no match, and the charge is referred upward for a missing receipt
that exists. The same applies to any backfilled import: every row carries the import date.

The fix is a `spend_date` column read from the document itself, with the arrival date kept
only as a fallback for a receipt with no readable date. Every seeded receipt now sits zero
days from its charge.

### And the first fix did nothing, for a reason worth recording

Adding the column changed no behaviour at all. Every receipt written before it existed had
`spend_date` null, so `coalesce` fell back to the arrival date and the query behaved exactly
as it had. The second run returned the identical five failures.

**A migration that changes a shape has to fill it for the rows already in it.** Bootstrap now
reads the date off any receipt that has none and writes it back, the schema version was
raised so the console actually asks for that bootstrap, and a receipt with no readable date
is left null rather than guessed at.

This is the same error as applying the schema only after a query had already failed: the
change was correct and the data already there was not considered.

**Declining to match rather than guessing was the correct half of this result.** The step is
instructed that a wrong match is worse than no match, and across ten attempts it never once
matched the wrong charge. The suite counts the two apart, and a single wrong match fails it
outright however good the overall rate is.

### End to end passed on its first run

Six charges through all five steps against the real database. All six completed. Two posted
entries and both balanced. Four were correctly referred upward or refused before reaching the
ledger.

That is the first evidence that what Gather produces is what Corroborate can actually
consume, and so on down the chain. Every other suite hands an agent input assembled by hand.

### Two reporting faults in the suites themselves

Both new suites reported spending nothing. Gather and Corroborate never carried their cost
out of the agent, so anything running them totalled zero. They do now.

And the end-to-end suite timed the whole charge and pushed that into a distribution of
per-call latencies, so four calls entered as one point and the median read as forty-nine
seconds. Each call is timed on its own now, and the time a whole charge takes is reported
separately, which is the number a Controller would actually ask about.

### A percentile on twenty calls is one call

The end-to-end run reported p95 at 93 seconds against a 40-second gate, on twenty calls. The
ninety-fifth percentile of twenty observations is the single slowest one, so the gate was
reporting one slow response as a failed budget.

That is the same arithmetic that took the consistency gate off small samples, and it had not
been applied to the latency gates. A percentile is now gated only when the run is long enough
to resolve it, roughly eighty calls for a p95, and reported plainly below that with the reason.

p50 is unaffected and stays gated: it passed at 7.3 seconds against 15.

### A cab charge matched to a hotel folio, once in twenty

A full run matched a INR 477 Uber charge to receipt R-2010, a INR 25,536 hotel folio for the
same employee two days later. Fifty-three times the amount and a different merchant.

**It is not a bug, and calling it one was wrong.** The same suite run on its own, before and
after, matched all ten correctly. No suite that runs before gather writes to receipts, and
gather reads only the transactions table, so the input was identical on both runs. The model
made a different call.

Nineteen correct out of twenty attempts. That is the honest figure.

**What it does tell us is that the instability is not confined to Decide.** The consistency
suite has only ever measured one agent, because that is the only one that had a suite. Gather
has the same property and now there is evidence for it, which makes splitting Decide a
narrower fix than it looked: the variance is a property of the approach, not of one prompt.

### The guard does not fix the model, it bounds the damage

A wrong match feeds the wrong amounts into every step after it, and the decision that follows
is confident and wrong. Declining to match is recoverable: the charge is referred upward for a
missing receipt, and a person looks at it.

**Which receipt is the right one is judgment and stays with the model. Whether two totals are
the same order of magnitude is arithmetic, so it does not.** A proposed match whose total is
outside 0.6 to 1.6 of the charge is refused and the refusal recorded, which turns the
dangerous failure into the safe one.

The tolerance is wide on purpose. A tip added after authorisation, a partial capture and a
currency rounding difference all move a total legitimately, and none of them move it by a
multiple.

**Which receipt is the right one is judgment and stays with the model. Whether two totals are
the same order of magnitude is arithmetic, so it does not.** A proposed match whose total is
outside 0.6 to 1.6 of the charge is refused and the refusal is recorded.

The tolerance is wide on purpose. A tip added after authorisation, a partial capture and a
currency rounding difference all move a total legitimately, and none of them move it by a
multiple.

### The guard nearly threw away two correct matches

Checked against the ten known-correct pairs before trusting it, the first version refused two:
Singapore Airlines and Emirates. Both were right, and both were foreign fares. The receipt
total read SGD 700.40 and AED 6,650 while the comparison used the INR conversion of the
charge, so a correct match looked like a sixty-fold error.

There is no rate table here, so a total printed in a currency other than the charge's is
simply not comparable and is not used. The charge is compared in its own currency.

**A guard against wrong matches that throws away right ones is worse than no guard.** It was
run against every pair in the corpus before it was kept, and all ten survive.

### Fixing the matching made a later step run out of room

A Singapore hotel charge failed at Post with the reply cut off at the token limit, having
already retried at double the budget.

It is a consequence of the receipt fix, not a coincidence. Before that fix R-2004 did not
match, so Post coded a bare foreign charge with no folio behind it. Once it matched, Post was
given a seven-line folio in a second currency with a tax split to code, which is several
times the output it used to produce. Two thousand four hundred tokens was sized for the
smaller job, and four thousand eight hundred on the retry was still not enough.

The budget is now 4,000, which doubles to 8,000 on a retry, and the test asserts both figures
rather than only the first. **A budget has to survive its own retry**: the earlier assertion
checked that Post had 2,400 and said nothing about what happens when that is not enough.

Worth recording because the shape recurs: a correct fix upstream changes the size of the
problem downstream, and nothing was measuring that.
