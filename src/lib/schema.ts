/* Bumped whenever db/schema.sql changes.
 *
 * Applying the schema only when a query threw meant a database that already
 * worked never received a new column. Everything added after the first bootstrap
 * silently did not exist, and the failure showed up as a button that did nothing.
 * The console compares this against what the database records and applies the
 * statements when it is behind. */
export const SCHEMA_VERSION = 16;

// Generated from db/schema.sql. Applied idempotently by /api/bootstrap.
export const DDL: string[] = [
  `create table if not exists employees (
  id            text primary key,
  name          text not null,
  email         text not null,
  grade         text not null,
  department    text not null,
  cost_center   text not null,
  base_currency text not null default 'INR',
  manager_name  text,
  joined_on     date
)`,
  `create table if not exists policy_versions (
  id         serial primary key,
  version    int not null,
  body       text not null,
  note       text,
  created_at timestamptz not null default now()
)`,
  `create table if not exists gl_accounts (
  code        text primary key,
  name        text not null,
  type        text not null,          -- expense | liability | asset | tax
  guidance    text
)`,
  `create table if not exists cost_centers (
  code text primary key,
  name text not null
)`,
  `create table if not exists calendar_events (
  id          text primary key,
  employee_id text references employees(id),
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  attendees   int
)`,
  `create table if not exists trips (
  id           text primary key,
  employee_id  text references employees(id),
  purpose      text,
  origin       text,
  destination  text,
  starts_on    date,
  ends_on      date,
  approved_by  text,
  budget_inr   numeric(14,2)
)`,
  `create table if not exists receipts (
  id            text primary key,
  employee_id   text references employees(id),
  source        text not null,               -- email | upload | vendor_api
  raw_text      text,
  image_b64     text,
  image_media   text,
  extracted     jsonb,                       -- filled by the vision extractor at runtime
  content_hash  text,
  created_at    timestamptz not null default now()
)`,
  `create table if not exists transactions (
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
)`,
  `create table if not exists cases (
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
)`,
  `create table if not exists agent_runs (
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
)`,
  `create table if not exists escalations (
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
)`,
  `create table if not exists precedents (
  id             serial primary key,
  escalation_id  int references escalations(id) on delete cascade,
  merchant       text,
  category       text,
  amount_band    text,
  situation      text not null,
  decision       text not null,
  rationale      text not null,
  created_at     timestamptz not null default now()
)`,
  `create table if not exists journal_entries (
  id         serial primary key,
  case_id    text references cases(id) on delete cascade,
  entry_ref  text not null,
  posted_at  timestamptz not null default now()
)`,
  `create table if not exists journal_lines (
  id           serial primary key,
  entry_id     int references journal_entries(id) on delete cascade,
  account_code text references gl_accounts(code),
  cost_center  text,
  debit        numeric(14,2) not null default 0,
  credit       numeric(14,2) not null default 0,
  memo         text
)`,
  `create table if not exists authority (
  id                   int primary key default 1,
  auto_approve_limit   numeric(14,2) not null default 100000,
  auto_reject_limit    numeric(14,2) not null default 50000,
  min_confidence       numeric(4,3)  not null default 0,
  escalate_risk_at     text          not null default 'HIGH',
  can_post_ledger      boolean       not null default true,
  can_reject           boolean       not null default true,
  updated_at           timestamptz   not null default now()
)`,
  `create table if not exists eval_cases (
  id            serial primary key,
  label         text not null,
  payload       jsonb not null,       -- a synthetic transaction + optional receipt text
  expect_verdict text not null,       -- APPROVE | REJECT | ESCALATE
  note          text
)`,
  `create table if not exists eval_runs (
  id          serial primary key,
  started_at  timestamptz not null default now(),
  policy_version int,
  total       int,
  correct     int,
  escalations int,
  avg_latency_ms int,
  total_cost_usd numeric(10,6),
  detail      jsonb
)`,
  `create index if not exists idx_txn_emp on transactions(employee_id)`,
  `create index if not exists idx_txn_merchant on transactions(merchant)`,
  `create index if not exists idx_case_status on cases(status)`,
  `create index if not exists idx_receipt_emp on receipts(employee_id)`,
  `create index if not exists idx_agentruns_case on agent_runs(case_id)`,
  `alter table authority add column if not exists mode text not null default 'autonomous'`,
  `alter table authority add column if not exists daily_spend_cap_usd numeric(10,4) not null default 5.0`,
  `alter table authority add column if not exists paused boolean not null default false`,
  `create table if not exists decision_log (
  id         serial primary key,
  case_id    text,
  event      text not null,
  payload    jsonb not null,
  prev_hash  text,
  hash       text not null,
  created_at timestamptz not null default now()
)`,
  `create table if not exists guardrail_events (
  id         serial primary key,
  case_id    text,
  kind       text not null,
  severity   text not null default 'info',
  detail     jsonb,
  created_at timestamptz not null default now()
)`,
  `create index if not exists idx_guardrail_kind on guardrail_events(kind)`,
  `create index if not exists idx_decisionlog_case on decision_log(case_id)`,
  `alter table transactions add column if not exists scenario text`,
  `create table if not exists company (
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
)`,
  `alter table agent_runs add column if not exists system_prompt text`,
  `alter table agent_runs add column if not exists input_payload text`,
  `alter table agent_runs add column if not exists raw_output text`,
  `alter table authority add column if not exists trace_enabled boolean not null default true`,
  `alter table escalations add column if not exists aria_verdict text`,
  `alter table cases add column if not exists reviewed_at timestamptz`,
  `alter table cases add column if not exists review_agreed boolean`,
  `alter table cases add column if not exists review_note text`,
  `alter table company add column if not exists schema_version int not null default 0`,
  `update authority set min_confidence = 0 where min_confidence > 0`,
  `alter table escalations add column if not exists kind text`,
  `alter table escalations add column if not exists proposed_allowed numeric(14,2)`,
  `alter table receipts add column if not exists spend_date date`,
];
