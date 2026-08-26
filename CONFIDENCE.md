# How the people who built this get confidence it is fit to show a customer

The question underneath: an answer key is one person's reading of one policy, so how
does a product eval mean anything for a customer whose policy nobody has seen?

The answer is that they are two different populations of test, measuring two
different things, and conflating them is the common mistake.

---

## Product evals: does the machinery work on any policy

These belong to whoever builds the product and run before anything ships. They must
be **policy-agnostic**, because a golden set tied to one document measures compliance
with that document rather than the ability to follow whatever document it is handed.
Those are different capabilities and only one of them is the product.

| Suite | The property under test | Gate |
|---|---|---|
| **Policy invariance** | Hold the charge constant, vary the rulebook. The verdict must track the document. | 90%, and the verdict must move between a strict and a lenient rulebook |
| Injection | Hostile text in a field the claimant controls must not move a verdict | 100% |
| Judgment | Silence, boundaries, contradictory evidence, and a case where escalating is the failure | 75% |
| Consistency | Same charge, repeated runs, modal verdict share | 90% |
| Closing | Every entry balances and uses only accounts that exist | 100% |

**Policy invariance is the one that answers the question.** Five rulebooks, one set of
charges. A cap of 9,000 with no exception, the same cap at 15,000, the same cap with a
sponsored-event exception, a policy silent on accommodation, and a policy whose rule
carries no figure at all. The same ₹9,400 hotel must be disallowed under the first,
allowed under the second, disallowed under the third unless the event is named, and
referred upward under the fourth.

An agent carrying a memorised industry default passes a single-policy golden set and
fails this one. That is the whole point.

The fifth variant is scored differently on purpose: where the rule carries no figure
there is no correct verdict, so what is checked is that no figure appears in a quoted
clause that is not in the document. Asserting a verdict there would be asserting an
opinion.

```
npm run eval -- invariance
```

## Customer evals: does it work on theirs

These belong to the customer and run during onboarding, not after.

**The real acceptance test is a backtest.** Take six months of expenses they have
already settled, with the decisions their own people made and the reasons they gave.
Run the agent against them. The measure is agreement with their own past decisions, and
the interesting output is not the percentage but the disagreements: some will be the
agent being wrong, and some will be their own inconsistency, which is worth surfacing
either way.

Where no history exists, **shadow mode is the eval**. She works every charge, records
every decision, acts on none, and you compare her against the people doing the work
today. Same measurement, gathered forward instead of backward.

The golden set in this build is tied to the starter policy and ships only when that
policy is in use. Paste your own and the Evaluation tab correctly reports that no
answer key exists, and says how to build one. That is not a limitation to work around,
it is the honest shape of the problem.

---

## What each population cannot tell you

| Population | Blind to |
|---|---|
| Product evals | Whether the customer's policy is even decidable. A rule saying "reasonable accommodation" cannot be applied by anyone, and no amount of product testing fixes it. |
| Customer backtest | Anything the customer has never seen. A new fraud pattern is absent from their history by definition. |
| Shadow mode | Rare cases. A month of shadow at low volume may contain no genuinely hard charge. |

Which is why all three run, and why the deployment rungs exist rather than a single
launch decision.
