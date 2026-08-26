import crypto from "node:crypto";
import { sql } from "../db";

/* ==========================================================================
 * 1. PII redaction
 *
 * Receipts carry card numbers, tax identifiers, personal email and phone.
 * None of that is needed to decide whether a charge is in policy, so none of
 * it leaves the perimeter. Redaction happens on the way to the model and the
 * original stays in the database, which means the audit trail is complete
 * while the model context is not.
 * ========================================================================== */

type Rule = { name: string; re: RegExp; numeric?: boolean; label?: (m: string) => string };

// A single rule owns every long digit run, because two rules competing for the
// same characters is how one of them silently stops firing. The label is decided
// after the match: a twelve digit run grouped four-four-four is an Aadhaar and
// keeps nothing, anything else is treated as a card and keeps the last four,
// which policy sometimes turns on and which identifies nobody.
const RULES: Rule[] = [
  {
    name: "long_digits", re: /\b\d(?:[ -]?\d){11,18}\b/g, numeric: true,
    label: (m) => {
      const d = m.replace(/\D/g, "");
      if (d.length === 12 && /^\d{4}[ -]\d{4}[ -]\d{4}$/.test(m.trim())) return "[AADHAAR REDACTED]";
      return `[CARD ending ${d.slice(-4)}]`;
    },
  },
  { name: "iban", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g },
  { name: "pan", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { name: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: "phone", re: /\b\+?\d(?:[ -]?\d){8,10}\b/g, numeric: true },
];

// A vendor GSTIN is a business registration, not personal data, and the Post step
// needs it to decide whether input tax is recoverable. Held out deliberately.
const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d\b/g;

export function redact(text: string): { text: string; found: Record<string, number> } {
  if (!text) return { text: "", found: {} };
  const found: Record<string, number> = {};
  const holds: string[] = [];
  let out = text.replace(GSTIN, (m) => { holds.push(m); return `\u0000${holds.length - 1}\u0000`; });

  for (const r of RULES) {
    out = out.replace(r.re, (m) => {
      // The length floor applies only to digit patterns. Applying it to an email
      // or a PAN silently disables the rule, which is how PII escapes unnoticed.
      if (r.numeric && m.replace(/\D/g, "").length < 9) return m;
      const replacement = r.label ? r.label(m) : `[${r.name.toUpperCase()} REDACTED]`;
      const key = replacement.startsWith("[CARD") ? "card"
        : replacement.startsWith("[AADHAAR") ? "aadhaar" : r.name;
      found[key] = (found[key] || 0) + 1;
      return replacement;
    });
  }
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => holds[Number(i)]);
  return { text: out, found };
}

/** Walks an object and redacts every string in it. */
export function redactDeep(value: any, found: Record<string, number> = {}): { value: any; found: Record<string, number> } {
  if (typeof value === "string") {
    const r = redact(value);
    for (const k in r.found) found[k] = (found[k] || 0) + r.found[k];
    return { value: r.text, found };
  }
  if (Array.isArray(value)) return { value: value.map((v) => redactDeep(v, found).value), found };
  if (value && typeof value === "object") {
    const o: any = {};
    for (const k in value) o[k] = redactDeep(value[k], found).value;
    return { value: o, found };
  }
  return { value, found };
}

/* ==========================================================================
 * 2. Citation verification
 *
 * The Decide step is required to quote the clause it relied on. Requiring a
 * quote is worthless unless somebody checks the quote is real, so this checks
 * it against the policy text with no model in the loop. A verdict resting on
 * a clause that is not in the document is not a decision, it is a fabrication,
 * and it goes to a human regardless of how confident the model was.
 * ========================================================================== */

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function verifyCitations(clauses: any[], policyBody: string) {
  const hay = norm(policyBody);
  const hayTokens = new Set(hay.split(" "));
  const checked = (clauses || []).map((c) => {
    const q = norm(c.quote || "");
    if (!q) return { ...c, verified: false, match: 0, reason: "No quote supplied." };
    if (hay.includes(q)) return { ...c, verified: true, match: 1 };

    // Allow for light paraphrase or an ellipsis, but not invention. Every figure
    // in the quote must appear in the policy: rewording is fair, changing a
    // number is the whole attack, and token overlap alone will wave it through.
    const qt = q.split(" ").filter(Boolean);
    const overlap = qt.filter((w) => hayTokens.has(w)).length / Math.max(qt.length, 1);
    const figures = qt.filter((w) => /\d/.test(w));
    const inventedFigure = figures.find((w) => !hayTokens.has(w));
    const verified = overlap >= 0.85 && !inventedFigure && qt.length >= 4;
    return {
      ...c,
      verified,
      match: Number(overlap.toFixed(2)),
      reason: verified ? "Close paraphrase of policy text."
        : inventedFigure ? `The figure "${inventedFigure}" does not appear in the policy.`
        : qt.length < 4 ? "Too short to verify as a quotation."
        : "This wording is not in the policy document.",
    };
  });
  const unverified = checked.filter((c) => !c.verified);
  return { clauses: checked, allVerified: unverified.length === 0, unverified };
}

/* ==========================================================================
 * 3. Operating limits
 *
 * Three switches that belong to the Controller and not to the agent: a mode,
 * a daily spend cap on the agent's own inference cost, and a pause.
 * ========================================================================== */

export type Mode = "shadow" | "suggest" | "autonomous";

export async function operatingState() {
  const a: any = await sql`select * from authority where id = 1`;
  const spend: any = await sql`
    select coalesce(sum(cost_usd),0)::float as spent from agent_runs
    where created_at >= date_trunc('day', now())`;
  const cap = Number(a[0]?.daily_spend_cap_usd ?? 25);
  const spent = Number(spend[0]?.spent ?? 0);
  return {
    trace_enabled: a[0]?.trace_enabled !== false,
    mode: (a[0]?.mode || "autonomous") as Mode,
    paused: !!a[0]?.paused,
    spentToday: spent,
    cap,
    capReached: spent >= cap,
    remaining: Math.max(0, cap - spent),
  };
}

/** Called before any work begins. Throws rather than half-running a case. */
export async function assertMayWork(caseId?: string) {
  const s = await operatingState();
  if (s.paused) {
    await logGuardrail(caseId, "paused", "high", { message: "Work stopped by the Controller." });
    throw new Error("Aria is paused. A Controller stopped her in the Governance tab.");
  }
  if (s.capReached) {
    await logGuardrail(caseId, "spend_cap", "high", { spentToday: s.spentToday, cap: s.cap });
    throw new Error(`Daily spend cap of $${s.cap.toFixed(2)} reached. Raise it in the Governance tab or wait for tomorrow.`);
  }
  return s;
}

/* ==========================================================================
 * 4. Tamper-evident decision log
 *
 * Every consequential act is appended with a hash of the previous entry. An
 * edit anywhere in history breaks the chain from that point on, and the break
 * is detectable without trusting the database.
 * ========================================================================== */

export async function appendDecision(caseId: string | null, event: string, payload: any) {
  const prev: any = await sql`select hash from decision_log order by id desc limit 1`;
  const prevHash = prev[0]?.hash || "genesis";
  const body = JSON.stringify({ caseId, event, payload });
  const hash = crypto.createHash("sha256").update(prevHash + body).digest("hex");
  await sql`insert into decision_log (case_id, event, payload, prev_hash, hash)
    values (${caseId}, ${event}, ${JSON.stringify(payload)}, ${prevHash}, ${hash})`;
  return hash;
}

export async function verifyChain() {
  const rows: any = await sql`select id, case_id, event, payload, prev_hash, hash from decision_log order by id`;
  let prevHash = "genesis";
  for (const r of rows) {
    const body = JSON.stringify({ caseId: r.case_id, event: r.event, payload: r.payload });
    const expect = crypto.createHash("sha256").update(prevHash + body).digest("hex");
    if (r.prev_hash !== prevHash || r.hash !== expect) {
      return { intact: false, entries: rows.length, brokenAt: r.id };
    }
    prevHash = r.hash;
  }
  return { intact: true, entries: rows.length, head: prevHash };
}

/* ========================================================================== */

export async function logGuardrail(caseId: string | null | undefined, kind: string, severity: string, detail: any) {
  try {
    await sql`insert into guardrail_events (case_id, kind, severity, detail)
      values (${caseId || null}, ${kind}, ${severity}, ${JSON.stringify(detail)})`;
  } catch {}
}
