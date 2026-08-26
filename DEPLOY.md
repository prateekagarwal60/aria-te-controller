# Deploy

Ten minutes, two free accounts, one public URL. Do this at least a day before the
presentation and run the checklist at the bottom.

---

## 1. Database (Neon, free tier)

1. Sign up at neon.tech, create a project. Any region; pick one near you.
2. Copy the connection string from the dashboard. It looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. Keep `?sslmode=require` on the end.

Neon's free tier suspends a database after inactivity and wakes it on the next query,
which adds a second or two to the first request. Load the app once before you present.

## 2. Repository

```bash
cd aria
git init && git add -A && git commit -m "Aria"
gh repo create aria-te-controller --private --source=. --push
```

Or create the repo in the GitHub UI and push to it.

## 3. Vercel

1. vercel.com, New Project, import the repository. Framework detects as Next.js.
2. Before clicking Deploy, add environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string from step 1 |
   | `ANTHROPIC_API_KEY` | your key |
   | `ARIA_PASSWORD` | optional; defaults to `prateekema26` |

   The whole site sits behind that password, API routes included, so a public URL
   is not a public application. It is a shared password rather than authentication:
   it keeps strangers out and it does not tell you who did what.

3. Deploy. First build takes about two minutes.
4. Open the URL. The app provisions the schema and seeds the corpus on first load.

The build succeeds even with no environment variables set, so a missing variable shows up
as a clear error in the app rather than a failed deploy. If you add the variables after the
first deploy, redeploy from the Vercel dashboard.

---

## Function timeouts

Each agent runs as its own HTTP call, so no single request holds the connection for long.
Routes are declared with `maxDuration = 60`, which Vercel's Hobby plan allows. Nothing in
the demo needs more.

---

## Cost

Roughly five model calls per charge. On the seeded corpus of eighteen charges, working the
whole queue costs a few cents. The header shows the running total, which is worth leaving
visible: an agent whose own operating cost is on screen reads as an employee with a salary
rather than a magic box.

---

## Pre-demo checklist

Run this the morning of, in order. It takes five minutes and it wakes the database, warms
the functions, and confirms every surface the panel might touch.

- [ ] Open the URL cold. Header shows Aria, the queue shows eighteen charges.
- [ ] Click **Work the queue**. Let it run to the end. Confirm a mix of settled, disallowed
      and referred upward. Confirm the touchless percentage moves.
- [ ] Open a settled charge. Confirm the workpaper shows exhibits, quoted policy clauses,
      the authority band and a balanced journal entry.
- [ ] Go to **Ledger**. Confirm the trial balance says in balance.
- [ ] Go to **Policy**. Change one number, for example the metro hotel cap in clause 4.1
      from 9,000 down to 6,000. Publish. Re-queue every charge. Re-run one hotel charge and
      confirm the verdict flips and the quoted clause shows the new number.
- [ ] Put the policy back, or leave it changed and say so.
- [ ] Go to **Escalations**. Resolve one with a written reason. Confirm a precedent appears
      in the **Precedent book**.
- [ ] Go to **Performance**. Run the review. Confirm it completes and shows an agreement
      percentage.
- [ ] Go to **Intake**. Add a charge with a strange merchant and no receipt. Run it. Confirm
      it is handled rather than crashing.
- [ ] Upload a receipt image. Confirm it is transcribed and the fields fill.
- [ ] Reset before the presentation: **Policy → Re-queue every charge**, then work the queue
      once so the panel arrives to a worked desk with real escalations waiting.

If anything above fails, you have time to fix it. If you skip this, you will find out live.

---

## Reset options

| Action | Where | Effect |
|---|---|---|
| Re-queue every charge | Policy tab | Clears verdicts, escalations, ledger. Keeps the precedent book. Use this to re-run the corpus against an edited policy. |
| Full reset | `POST /api/reset` with `{"scope":"everything"}` | Also clears precedents and the evaluation history. |

The precedent book surviving a re-queue is deliberate. It is the thing Aria learned, and it
should outlive a re-run of the same charges.
