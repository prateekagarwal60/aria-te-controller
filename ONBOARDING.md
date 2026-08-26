# What to have ready before you hire her

Seven screens. Every one sets something she actually reads at decision time, and
every one can be changed afterwards. Skipping straight through with the defaults
takes about ninety seconds; doing it with your own material takes longer and is
the more interesting demo.

---

## 1. The employer

| Field | Example | Why it is asked |
|---|---|---|
| Company | Meridian Systems | Appears on her workpapers |
| Legal entity | Meridian Systems India Private Limited | The entity the policy binds |
| Home currency | INR | Foreign charges are converted to it |
| Jurisdiction | India | Decides whether input tax is recoverable and what a valid vendor registration looks like |
| Fiscal year starts | April | Quarterly allowances, such as the self-certification limit |
| She reports to | Corporate Controller | Who receives an escalation |
| What you call her | your choice | A name reinforces a role. A function label reinforces a tool. Check whatever you pick does not already mean something else. |

## 2. The policy

Paste your own, or load the starter and edit it.

**What makes a policy she can work with:**

- **Numbered clauses.** She cites them back and every citation is checked against the text. Clauses you can point at make her decisions checkable; a wall of prose does not.
- **Explicit figures.** "Nightly cap INR 9,000" is decidable. "Reasonable accommodation" is not, and she will correctly refuse to guess.
- **Named exceptions.** If an over-cap rate is allowed at a sponsored event, say so and say what evidence is required.
- **Say what is prohibited outright**, separately from what is capped. They are different decisions.
- **Say what happens when the policy is silent.** The starter escalates. That is a choice, and it is yours.

The starter covers twelve sections: scope, pre-trip approval, air, accommodation, meals, client and team meals, alcohol, ground transport, receipts and evidence, prohibited spend, currency and tax, enforcement.

## 3. The books

**Chart of accounts**, one per line: `code, name, type`

```
6100, Travel - Airfare, expense
6110, Travel - Accommodation, expense
6130, Travel - Meals (Individual), expense
6140, Entertainment - Client, expense
1310, Input Tax Credit - GST, tax
2110, Corporate Card Liability, liability
2120, Employee Payables - Reimbursements, liability
```

You need at least one expense account, one liability for the card, one liability for
employee reimbursements, and a tax account if you want input tax split out. Include a
recoverable-from-employee account if you want partial allowances to have somewhere to land.

**Cost centres**, one per line: `code, name`

```
CC-ENG, Engineering
CC-SAL, Sales
CC-MKT, Marketing
```

She may only post to codes that exist here. An account she invents is caught before
anything reaches the ledger, which is what makes this list a guardrail rather than a
convenience.

## 4. The people

One per line: `id, name, email, grade, department, cost centre, manager`

```
E-1001, Ananya Rao, ananya.rao@x.com, M4 Senior Manager, Sales, CC-SAL, Vikram Shah
E-1004, Imran Qureshi, imran.qureshi@x.com, VP, Sales, CC-SAL, Vikram Shah
```

**Grade is load-bearing.** Several clauses turn on seniority, and the interesting cases
are the ones where grade nearly but does not quite settle it. A VP flying business class
still needs the written approval clause 3.3 asks for: grade is not the approval.

The cost centre must exist in the chart from step 3.

## 5. Her authority

| Setting | Starting point | What moving it does |
|---|---|---|
| Allow on her own, up to | INR 1,00,000 | Above this an allowance goes to you even when she is confident |
| Disallow on her own, up to | INR 50,000 | Was INR 5,000, on the argument that refusing someone's money is the more consequential direction. That argument does not survive scrutiny: a wrong rejection is noticed immediately by the person it costs and gets appealed, while a wrong approval is noticed by nobody. The direction needing the tighter leash is approval. Some ceiling is still sensible, because a wrong refusal of a large amount damages trust in the system, but 5,000 sent almost every real rejection to a human for no safety gain. |
| Send it to you below a confidence of | off | She already says when she cannot decide, in words, with the reason. This is a number she gives herself that nothing has checked and that moves by as much as 0.2 on the same charge, so a floor makes a charge near the line settle or escalate at random. Turn it on only once the review shows what her numbers are worth. |
| Risk band that forces escalation | High | Set to Medium while you are still learning what her risk scores mean |
| Daily cap on her own cost | $5 | She stops working when she has spent this on herself in a day |
| May post to the ledger | on | Off makes her advisory only |
| May disallow | on | Off means every rejection goes to you |

These are checked in code after she decides. Nothing written in a receipt can widen them.

## 6. How she starts

**Shadow** is the honest default. She decides and records every charge and never acts,
so you can run her alongside whoever does the work today and compare. Move to **suggest**
when you want her calls put to a person, and to **autonomous** when the evaluation says
she has earned it.

Nobody should switch straight to autonomous. The rung is a setting, not a deploy, which
means stopping a bad rollout is a switch rather than a release.

## 7. Day one

**A sample month, eighteen charges.** Each labelled with what it puts under pressure: a
hotel over cap, alcohol on a team bill, business class with no written approval, a
reimbursement claim with no card record, two charges split across a single day. Four of
the 13 corroboration checks work only by comparing a charge against every other charge,
so this is what lets you see them fire.

**Or nothing.** Add charges yourself under *Add a charge* and watch each go through. Honest
about what this costs: with no history, the cross-charge checks have nothing to compare
against, exactly as a human controller would find on their first morning.

---

## Coming back to a screen

Every screen shows what is already saved. The policy screen loads the version on file and
tells you whether you have edited it; the books and people screens load the rows on file.
Saving on those two screens **replaces** what is there rather than adding to it, which is
said on the screen.

## Starting again

Two ways, and they do different things.

| | What it clears | When |
|---|---|---|
| `npm run fresh` | Drops every table. Next page load rebuilds the schema and starts at screen one. | Before a presentation, or any time you want a genuine first install. |
| `npm run db:reset -- work` | Clears charges, cases, escalations, ledger, precedents and logs. Keeps the company, policy, books, people and authority. | You want to re-run the same corpus against an edited policy. |
| **Controls → Erase everything and re-hire** | Same as `npm run fresh`, from inside the app. | You are already in the console and do not want a terminal. |

`npm run fresh` reads `.env.local` itself, so it does not depend on your Node version.
