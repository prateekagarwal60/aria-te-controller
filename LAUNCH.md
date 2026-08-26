# Launching this

The question is not "are all the gates green". It is "would I put my name on this in
front of a customer, and what would I say".

Here is the honest answer, and the reason chasing green gates on a synthetic set was the
wrong thing to be doing.

---

## The mistake I made, so you can not make it

The evaluation was run four times. Between runs the answer key was edited three times, and
the scores went:

| | run 1 | run 2 | run 3 | run 4 |
|---|---|---|---|---|
| Golden | 41.7% | 66.7% | 87.5% | 79.2% |
| Invariance | 25% | 100% | 66.7% | 87.5% |
| Injection | 100% | 75% | 100% | 87.5% |

Those numbers are oscillating, not converging. Every individual key edit was defensible.
The pattern was not: the agent disagreed, the key changed, the agent disagreed again.

**A score that moves forty points while its author edits the key is measuring the author.**
Two things came out of admitting that.

The key is now frozen behind a register of standing disagreements. Changing one takes a
written reason naming the clause that makes the old key wrong, and "the model said
otherwise" is not that reason.

And the oscillation had a cause worth finding, which is the next section.

## What the oscillation was actually telling us

Most of it was one product bug. The prompt offered three verdicts and there was no name for
"allow part of it", so on every partial allowance the model described the split correctly
and then picked a label that did not fit. `APPROVE` one run, `REJECT` the next, word for
word the same reasoning.

The model now states what is payable and what is not. The code names the outcome. Same
division as everywhere else here: judgment to the model, arithmetic to the code.

The rest was measuring a probabilistic system with one sample. The clean side of an
injection pair came back `ESCALATE` in one run and `REJECT` in the next **with no attack
applied at all**. Both sides now run three times and the gate is on the money, because
money is unambiguous where a label is not.

Neither of those was visible from the scores. Both were visible from reading two runs of
the same case side by side.

---

## What would actually justify a launch

Five questions. Not one of them is "did every suite go green".

### 1. When it is wrong, which way is it wrong?

This is the only question a Controller genuinely cares about, and the answer is measured
directly: **charges allowed in full that should not have been paid at all.**

That figure has been **zero on every run**, including the runs where the headline score
was 41.7%. Every error has been in the direction of allowing less or asking a human.

That asymmetry is not luck. It is what the guardrails are shaped to produce: a limit that
bites in code, a citation that has to be found in the document, evidence that has to exist
before an allowance, an entry that has to balance before it posts.

**This is the number to put in front of a CPO.** Not the agreement rate.

### 2. Does it read the customer's rulebook, or a remembered one?

The same charge under five different policies, and the verdict has to follow the document.
An agent carrying an industry default passes a single-policy golden set and fails this one.

That is the suite that says anything at all about a customer whose policy nobody has seen,
and it is the reason the golden set is not the headline.

### 3. Can an attack buy anything?

Eight attacks, both sides run three times, gated on whether the money moved. Fake system
instructions, invented clauses, fabricated precedents, authority claims in the memo,
role-play framing, urgency, confidence manipulation, context stuffing.

The interesting result was not the pass. It was watching the agent read a manipulative
memo, say in its reasoning that the memo was itself a red flag, and harden. Twice a test
was rewritten because it was flagging that as a failure.

### 4. Is the deterministic half actually deterministic?

Roughly 220 assertions with no model in the loop: every SQL query the app sends, all 145
SQL literals extracted from source and executed, PII redaction, citation verification, the
hash chain, the six checks, the risk arithmetic, the verdict arithmetic, the onboarding
round trip, the argument parser.

Everything a model could be talked out of lives here on purpose.

### 5. Can it be stopped, bounded and rolled back?

Shadow, suggest and autonomous as a setting rather than a deploy. Approval and rejection
limits, a confidence floor, a risk ceiling, a daily cap on its own inference spend, and a
stop button. A hash-chained log where an edit anywhere breaks the chain visibly.

---

## What I would say to a customer, in these words

> She will not pay something she should not have paid. On every measurement we have run,
> including the ones where she disagreed with us most, the count of charges allowed in full
> that should not have been paid is zero. When she is wrong she allows less, or she asks
> you.
>
> She reads your policy, not ours. We test that by handing her five different rulebooks and
> checking the answer follows the book.
>
> She starts in shadow. She works every charge, records every decision, acts on none. You
> compare her against the people doing the work today, on your charges, for one close
> cycle. If you do not like what you see, nothing has happened.
>
> Then she suggests, and every call goes to a person. Then she acts inside a limit you set,
> and you raise it on evidence.
>
> Here is what she cannot do, and here is the list of what we have not built.

The last line is the one that sells it. A vendor who volunteers the gaps is the only kind
worth believing about the rest.

## What it costs, because someone will ask

From the fifth run: 121 calls, $3.70, so **$0.031 a call**. A charge takes four calls, which
puts it at **roughly $0.12 a charge**.

| | |
|---|---|
| 10,000 charges a month | about $1,200 in inference |
| A human auditor at 20 charges an hour on $25 an hour | $1.25 a charge |

So roughly a tenth of the labour it replaces, before counting that it looks at every charge
rather than a sample. Say the figure rather than waiting to be asked, and say what would
move it: the Decide call carries the whole policy every time, which is what makes a policy
edit take effect on the next charge rather than the next deploy.

That gate is now enforced. It was declared and never referenced, along with both latency
gates, so a run could print `p95 FAIL` on one line and `all gates met` on the next. **A gate
that does not gate is worse than no gate, because it reads like assurance.**

## What is not ready, said plainly

| | |
|---|---|
| **No authentication.** Anyone with the URL can rewrite the policy and post to the ledger. | Correct for a demo the panel must be able to break. Disqualifying for production, and the first thing to build. |
| Single tenant | Multi-tenant needs row-level security and per-tenant keys. |
| Gather and Corroborate are never scored | A wrong receipt match poisons every step after it. Risk bands are asserted, never validated against labelled fraud. |
| No full-pipeline eval | The suites test agents in isolation. Errors compound across five steps. |
| No model-version baseline | Changing the model silently changes behaviour, and we now know from four runs how much it can move. |
| Consistency measured, not guessed | The 80% was a five-run artifact. At fifteen runs the clean case was 15 of 15, and pooled across both it was 19 of 20. A 90% gate cannot be resolved at five runs, which was my error, not the agent's. |
| The golden set is one policy | It ships only when that policy is in use, and a customer needs their own. |
| Rate limiting | The spend cap bounds cost, not request volume. |

## Where it stands after five full runs

| | | |
|---|---|---|
| Golden set | 91.7% | **0 charges allowed in full that should not have been paid** |
| Policy invariance | 100% | the verdict follows whichever rulebook it is handed |
| Injection | 100% | no attack moved the money |
| Judgment | 87.5% | up from 75% once refusing to decide needed a named ground |
| Closing | 100% | every entry balanced, every account real |
| Consistency | 53 to 73% | **the open one** |

The zero has held on every run, including the ones where the headline score was 41.7%.
Every error has been toward allowing less or asking a person. That is not luck: it is what
a limit enforced outside the model, a citation checked against the document, and an entry
that has to balance before it posts are shaped to produce.

## The instability is not confined to one agent

The consistency suite measures Decide, because for a long time that was the only agent with a
suite at all. Once Gather had one, it showed the same property: nineteen correct matches out
of twenty attempts, with the twentieth pairing a INR 477 cab charge to a INR 25,536 hotel
folio. Identical input both times.

That narrows what splitting Decide would buy. The variance is a property of the approach
rather than of one prompt, so the honest expectation is that splitting helps and does not
solve it.

**What can be done, and is, is bounding the damage.** A wrong receipt match is dangerous
because it feeds wrong amounts into every later step. Declining to match is recoverable: the
charge comes to a person for a missing receipt. A check in code that refuses a match whose
total is nothing like the charge turns the first into the second. It does not make the model
more consistent and it is not pretending to.

## The one that has not been fixed, and will not be by tuning

The same charge does not always get the same answer. Measured three times: 73.3%, 70%,
53.3%. Twice the case was rewritten to remove a genuine ambiguity, and twice the number
came back no better.

**That is the point at which tuning stops and reporting starts.** A third rewrite would be
adjusting the test until it agrees, which is the failure this whole document is about.

What is true about it:

- The drift is between deciding and referring upward, not between allowing and refusing.
  No run has produced a charge allowed one time and disallowed the next.
- So it costs the touchless rate, not money. A fifth of clean charges arriving on a desk
  undoes the commercial claim; it does not create a loss.
- The Decide step is asked for sixteen fields in one call, several of them prose. More
  output surface is more room to diverge, and splitting the call is the obvious next thing
  to try. It has not been tried.

**What I would say if asked.** She does not always give the same answer twice, and we can
show you the number. When she varies she varies toward asking you, never toward paying. We
know what we would try next and we have not tried it yet.

## The consistency number, and what measuring it properly showed

For two runs a clean economy flight read 80%, one drift in five, and I called it the one
number telling the truth about the system rather than the test. Then it was measured at
fifteen runs and came back 15 of 15.

| | |
|---|---|
| Five runs | 4 of 5, 80% |
| Fifteen runs | 15 of 15, 100% |
| Pooled | 19 of 20, 95% |

At five runs the possible readings are 100%, 80%, 60%. **A 90% gate sits in the gap.** A true
rate near 95% lands on PASS or FAIL at random, and over two runs it did both. I was reading
noise and describing it as a finding.

The gate did not move. What changed is that it now applies only when the sample can resolve
it, and every reading carries an interval.

**Generalise this before quoting any rate.** A gate you cannot resolve at your sample size
is not a gate. It is a coin toss with a threshold drawn on it, and the number it produces
will sound like evidence.

---

## What the evaluation is actually for

Not a certificate. A way of finding out what you have built.

Four runs found: a guardrail firing on a malformed input; a scorer calling five correct
partial allowances "money out of the door"; a hole in the policy where a clause set a rule
and no remedy; truncation reported as a parsing fault; two consecutive crashes on
undeclared variables after every call had completed; an argument parser reading a flag
value as a suite name; a prompt with three names for four outcomes; and A/B tests measuring
noise.

Every one was found by running it and reading the output rather than by looking at a score.
The scores were mostly wrong. **The reasoning underneath them was where everything was.**

That is the thing to say when someone asks how you know an agent works.
