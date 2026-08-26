-- Aria, T&E Controller. Every input the agent reasons over is a row here.
-- Nothing that affects a decision is hardcoded in application code.

create table if not exists employees (
  id            text primary key,
  name          text not null,
  email         text not null,
  grade         text not null,
  department    text not null,
  cost_center   text not null,
  base_currency text not null default 'INR',
  manager_name  text,
  joined_on     date
);

-- Policy is a live, versioned document. The panel can rewrite it in the UI.
create table if not exists policy_versions (
  id         serial primary key,
  version    int not null,
  body       text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- Chart of accounts and cost centers are data, so GL coding is not a lookup table in code.
create table if not exists gl_accounts (
  code        text primary key,
  name        text not null,
  type        text not null,          -- expense | liability | asset | tax
  guidance    text
);

create table if not exists cost_centers (
  code text primary key,
  name text not null
);

-- Evidence sources the Assembler can draw on.
create table if not exists calendar_events (
  id          text primary key,
  employee_id text references employees(id),
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  attendees   int
);

create table if not exists trips (
  id           text primary key,
  employee_id  text references employees(id),
  purpose      text,
  origin       text,
  destination  text,
  starts_on    date,
  ends_on      date,
  approved_by  text,
  budget_inr   numeric(14,2)
);

create table if not exists receipts (
  id            text primary key,
  employee_id   text references employees(id),
  source        text not null,               -- email | upload | vendor_api
  raw_text      text,
  image_b64     text,
  image_media   text,
  extracted     jsonb,                       -- filled by the vision extractor at runtime
  content_hash  text,
  created_at    timestamptz not null default now()
);

create table if not exists transactions (
  id           text primary key,
  employee_id  text references employees(id) not null,
  merchant     text not null,
  mcc          text,
  amount       numeric(14,2) not null,
  currency     text not null default 'INR',
  amount_inr   numeric(14,2) not null,
  txn_date     date not null,
  txn_time     text,
  card_last4   text,
  source       text not null default 'card_feed',
  memo         text,
  created_at   timestamptz not null default now()
);

-- One case per transaction. This is Aria's unit of work.
create table if not exists cases (
  id             text primary key,
  transaction_id text references transactions(id) not null,
  status         text not null default 'queued',  -- queued|working|settled|escalated|rejected|held
  verdict        text,                            -- APPROVE|REJECT|ESCALATE
  confidence     numeric(4,3),
  risk_band      text,
  risk_score     int,
  amount_allowed numeric(14,2),
  policy_version int,
  assembled      jsonb,
  investigation  jsonb,
  adjudication   jsonb,
  closing        jsonb,
  authority      jsonb,
  opened_at      timestamptz not null default now(),
  closed_at      timestamptz
);

-- Every agent invocation is logged: model, tokens, latency, cost. This is the work log.
create table if not exists agent_runs (
  id          serial primary key,
  case_id     text references cases(id) on delete cascade,
  agent       text not null,
  model       text,
  input_tok   int,
  output_tok  int,
  latency_ms  int,
  cost_usd    numeric(10,6),
  ok          boolean default true,
  error       text,
  created_at  timestamptz not null default now()
);

-- When Aria hits the edge of her authority or confidence she escalates here.
create table if not exists escalations (
  id             serial primary key,
  case_id        text references cases(id) on delete cascade,
  reason         text not null,
  question       text not null,
  recommendation text,
  status         text not null default 'open',   -- open | resolved
  human_decision text,
  human_rationale text,
  resolved_by    text,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- The learning loop. A resolved escalation becomes a precedent Aria cites next time.
create table if not exists precedents (
  id             serial primary key,
  escalation_id  int references escalations(id) on delete cascade,
  merchant       text,
  category       text,
  amount_band    text,
  situation      text not null,
  decision       text not null,
  rationale      text not null,
  created_at     timestamptz not null default now()
);

-- Real double-entry ledger. Aria posts here; the trial balance must balance.
create table if not exists journal_entries (
  id         serial primary key,
  case_id    text references cases(id) on delete cascade,
  entry_ref  text not null,
  posted_at  timestamptz not null default now()
);

create table if not exists journal_lines (
  id           serial primary key,
  entry_id     int references journal_entries(id) on delete cascade,
  account_code text references gl_accounts(code),
  cost_center  text,
  debit        numeric(14,2) not null default 0,
  credit       numeric(14,2) not null default 0,
  memo         text
);

-- Aria's employment terms. Editable in the UI, enforced in code.
create table if not exists authority (
  id                   int primary key default 1,
  auto_approve_limit   numeric(14,2) not null default 100000,
  auto_reject_limit    numeric(14,2) not null default 50000,
  min_confidence       numeric(4,3)  not null default 0,
  escalate_risk_at     text          not null default 'HIGH',
  can_post_ledger      boolean       not null default true,
  can_reject           boolean       not null default true,
  updated_at           timestamptz   not null default now()
);

-- Golden set for the eval harness. Expected verdicts written by a human.
create table if not exists eval_cases (
  id            serial primary key,
  label         text not null,
  payload       jsonb not null,       -- a synthetic transaction + optional receipt text
  expect_verdict text not null,       -- APPROVE | REJECT | ESCALATE
  note          text
);

create table if not exists eval_runs (
  id          serial primary key,
  started_at  timestamptz not null default now(),
  policy_version int,
  total       int,
  correct     int,
  escalations int,
  avg_latency_ms int,
  total_cost_usd numeric(10,6),
  detail      jsonb
);

create index if not exists idx_txn_emp on transactions(employee_id);
create index if not exists idx_txn_merchant on transactions(merchant);
create index if not exists idx_case_status on cases(status);
create index if not exists idx_receipt_emp on receipts(employee_id);
create index if not exists idx_agentruns_case on agent_runs(case_id);

-- Governance additions. Applied with "if not exists" so an already-provisioned
-- database picks them up without a migration step.
alter table authority add column if not exists mode text not null default 'autonomous';
alter table authority add column if not exists daily_spend_cap_usd numeric(10,4) not null default 5.0;
alter table authority add column if not exists paused boolean not null default false;

-- Tamper-evident decision log. Each row hashes the previous row's hash, so any
-- edit to history breaks the chain and the break is visible.
create table if not exists decision_log (
  id         serial primary key,
  case_id    text,
  event      text not null,
  payload    jsonb not null,
  prev_hash  text,
  hash       text not null,
  created_at timestamptz not null default now()
);

-- Anything a guardrail caught. Kept separately from the decision log so the
-- record of what was blocked survives a re-queue of the work.
create table if not exists guardrail_events (
  id         serial primary key,
  case_id    text,
  kind       text not null,
  severity   text not null default 'info',
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardrail_kind on guardrail_events(kind);
create index if not exists idx_decisionlog_case on decision_log(case_id);

-- Why a seeded charge is in the corpus. Shown in the console so the queue reads
-- as a set of scenarios rather than eighteen unexplained rows.
alter table transactions add column if not exists scenario text;

-- The employer. Until onboarded_at is set, the agent has not been hired and the
-- console shows the onboarding flow instead of the queue.
create table if not exists company (
  id                int primary key default 1,
  name              text,
  legal_entity      text,
  home_currency     text not null default 'INR',
  jurisdiction      text not null default 'India',
  fiscal_year_start text not null default 'April',
  agent_name        text not null default 'the Controller',
  reports_to        text not null default 'Corporate Controller',
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- Full trace of what was sent to the model and what came back. Nothing about the
-- agent should be unreadable by the person who owns it.
alter table agent_runs add column if not exists system_prompt text;
alter table agent_runs add column if not exists input_payload text;
alter table agent_runs add column if not exists raw_output text;
alter table authority add column if not exists trace_enabled boolean not null default true;

-- What she recommended, kept beside what the human decided, so it is possible to
-- tell whether an escalation changed anything.
alter table escalations add column if not exists aria_verdict text;

-- Whether a human has looked at a charge she settled herself, and whether they
-- agreed. Without this the touchless figure is a claim nobody can check.
alter table cases add column if not exists reviewed_at timestamptz;
alter table cases add column if not exists review_agreed boolean;
alter table cases add column if not exists review_note text;

-- What schema this database has been brought up to.
alter table company add column if not exists schema_version int not null default 0;

-- The confidence floor gated a decision on a number the model gives itself, which
-- moves by as much as 0.2 on identical input. Any value already set is cleared.
update authority set min_confidence = 0 where min_confidence > 0;

-- Whether she had a view and needed permission, or had no view and needed a
-- decision. Storing both the same way made answering a question count as
-- overturning a recommendation.
alter table escalations add column if not exists kind text;
alter table escalations add column if not exists proposed_allowed numeric(14,2);

-- The date printed on the receipt, which is what a charge should be matched
-- against. Filtering on created_at matched against when the row was inserted,
-- so a receipt uploaded three weeks after a trip fell outside the window.
alter table receipts add column if not exists spend_date date;
