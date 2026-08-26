# What varies between customers, and where it lives

Three layers. Two are built, one is not, and pretending otherwise would show up
in the first customer conversation.

---

## Layer 1: Configuration. Built.

Data the agent reads at decision time. Set during onboarding, changed any time.

| Varies by org | Where |
|---|---|
| The expense policy | A versioned document. Rewritten in the console, applied on the next charge. |
| Chart of accounts, cost centres | Tables. She may only post to codes that exist. |
| People, grades, departments | Table. Grade drives several clauses. |
| Currency, jurisdiction, fiscal year | Company record. Drives tax treatment and quarterly allowances. |
| Approval and rejection limits, confidence floor, risk ceiling | Authority record, enforced in code. |
| Deployment rung | Setting, not a deploy. |

This layer covers more than it looks like it does, because the policy is a
document rather than a form. A rule nobody anticipated can be written in prose and
she will apply it, cite it, and be checked on the citation.

## Layer 2: Workflow and routing. Not built.

Where real deployments diverge and this build currently assumes one answer.

| Varies by org | What is assumed here | What is actually needed |
|---|---|---|
| Who receives an escalation | Everything goes to one Controller | Routing by amount, department, entity, region. A ₹5,000 query goes to a team lead; a ₹5,00,000 one does not. |
| Which steps run | All five, always | Some orgs want a separate fraud review before posting. Some will not let an agent post at all and want a batch for import. |
| What triggers work | A charge arrives | Some want end-of-week batches, some want real time, some want approval before spend. |
| Custom fields | None | Project code, client matter, grant number. Often mandatory and often the reason a charge is queried. |
| Evidence sources | Card feed, receipt, calendar, trip | One org has a travel agency feed, another has a procurement system, another has neither. |
| Notification and SLA | None | Where escalations appear, how long before they chase. |

**The honest answer for a company shaped like Ema:** this layer belongs to the
platform, not to this agent. A generative workflow engine with an agent builder is
exactly the thing that makes routing, triggers and step composition configurable
without a fork per customer. The T&E Controller is then an AI employee *built on*
that platform rather than a product that has to grow its own workflow engine.

Saying that is stronger than pretending the gap is not there, and it points at why
a horizontal agent platform is the right place to build this rather than a
seventh point solution.

## Layer 3: Extension. Not built.

Genuinely org-specific work: a connector to an in-house ERP, an agent that applies a
union agreement or a government grant rule, a bespoke fraud model trained on their
own history. This is professional services or an SDK, not configuration, and the
mistake is trying to express it as settings.

---

## The rule for deciding which layer something belongs in

If it changes **what is true** for a customer, it is configuration. If it changes
**what happens next**, it is workflow. If it changes **what the agent can do at all**,
it is extension.

A cap of 9,000 rather than 15,000 is configuration. A second approver above ₹2 lakh is
workflow. Reading a union agreement is extension. Building all three into onboarding
screens produces a form nobody can fill in.
