import Anthropic from "@anthropic-ai/sdk";
import { sql } from "./db";

export const MODEL = process.env.ARIA_MODEL || "claude-sonnet-5";

// Public list pricing, USD per token. Powers the cost meter only.
const PRICE_IN = 3.0 / 1_000_000;
const PRICE_OUT = 15.0 / 1_000_000;

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/* Some models reject a temperature at all. Nothing here needs one: every call
   asks for a fixed structured answer, and determinism comes from the prompt and
   from the code that checks the output, not from a sampling parameter. Set
   ARIA_TEMPERATURE only if you are on a model that wants it. */
const TEMPERATURE = process.env.ARIA_TEMPERATURE !== undefined
  ? Number(process.env.ARIA_TEMPERATURE) : undefined;

export type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/**
 * Pulls a JSON object out of a model response without assuming the response is
 * only JSON. Handles a fenced block, a preamble, a trailing sentence, and braces
 * that appear inside string values. Not every model accepts an assistant prefill,
 * so nothing here depends on one.
 */
/* A complete object can still fail to parse.
 *
 * One call in a hundred and twenty one came back with well-formed JSON that
 * JSON.parse refused, and it was not truncation: the object had closed. The cause
 * is a raw newline or tab inside a string value, which models emit and the spec
 * forbids. Escaping control characters that sit inside a string literal repairs
 * exactly that and touches nothing else, because the walk knows when it is inside
 * a string and when it is not. */
function repairControlChars(text: string): string {
  let out = "", inStr = false, esc = false;
  for (const ch of text) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (ch < " ") continue;   // any other control character is dropped
    }
    out += ch;
  }
  return out;
}

function tryParse(text: string): any | null {
  try { return JSON.parse(text); } catch { /* fall through to the repair */ }
  try { return JSON.parse(repairControlChars(text)); } catch { return null; }
}

export function extractJson(raw: string): any | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], raw].filter(Boolean) as string[];

  for (const c of candidates) {
    const trimmed = c.trim();
    const direct = tryParse(trimmed);
    if (direct) return direct;

    const start = trimmed.indexOf("{");
    if (start < 0) continue;

    // Walk the braces, ignoring any inside string literals, so a closing brace
    // in a piece of quoted policy text does not truncate the object.
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const parsed = tryParse(trimmed.slice(start, i + 1));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

const JSON_RULE =
  "\n\nReply with one JSON object and nothing else. No preamble, no explanation outside the " +
  "object, no markdown fences. Start the reply with { and end it with }.";

/**
 * Every decision Aria makes passes through here. There is no rules engine in this
 * application. One retry on unparseable output, then it fails loudly rather than
 * guessing, because a silently wrong decision is worse than a visible failure.
 */
export async function think(opts: {
  agent: string;
  caseId?: string | null;
  system: string;
  content: Block[] | string;
  maxTokens?: number;
}): Promise<{ json: any; raw: string; usage: any; latency: number; cost: number; truncated: boolean; attempts: number }> {
  const t0 = Date.now();
  const content =
    typeof opts.content === "string"
      ? [{ type: "text" as const, text: opts.content }]
      : opts.content;

  let raw = "";
  let usage: any = { input_tokens: 0, output_tokens: 0 };
  let err: string | null = null;
  let json: any = null;
  let truncated = false;
  let attempts = 0;
  let budget = opts.maxTokens ?? 2000;

  for (let attempt = 0; attempt < 3 && !json; attempt++) {
    attempts = attempt + 1;
    try {
      const msgs: any[] = [{ role: "user", content: content as any }];
      if (attempt === 1) {
        msgs.push({ role: "assistant", content: raw || "(no output)" });
        msgs.push({ role: "user", content: "That was not valid JSON. Send the same answer again as one JSON object only." });
      }
      const res = await getClient().messages.create({
        model: MODEL,
        max_tokens: budget,
        ...(TEMPERATURE !== undefined ? { temperature: TEMPERATURE } : {}),
        system: opts.system + JSON_RULE,
        messages: msgs,
      } as any);
      const u = res.usage || { input_tokens: 0, output_tokens: 0 };
      usage = {
        input_tokens: (usage.input_tokens || 0) + (u.input_tokens || 0),
        output_tokens: (usage.output_tokens || 0) + (u.output_tokens || 0),
      };
      raw = res.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
      truncated = res.stop_reason === "max_tokens";
      json = extractJson(raw);
      err = null;
      if (!json && truncated && attempt === 0) {
        // Not a parsing problem. The object never finished, so give it room and
        // start again rather than asking a model to repair its own truncation.
        budget = Math.min(budget * 2, 8000);
        continue;
      }
    } catch (e: any) {
      err = e?.message || String(e);
      break;
    }
  }

  const latency = Date.now() - t0;
  const cost = (usage.input_tokens || 0) * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;

  if (opts.caseId) {
    try {
      // The exact prompt and the exact reply are kept, not a summary of them.
      // An agent whose owner cannot read what it was asked is a black box, and a
      // black box cannot be debugged, audited or defended. Turn it off under
      // Controls if you would rather not retain payloads.
      const a: any = await sql`select trace_enabled from authority where id = 1`;
      const trace = a[0]?.trace_enabled !== false;
      const asText = content
        .map((c: any) => (c.type === "text" ? c.text : `[image, ${c.source?.media_type}, ${Math.round((c.source?.data?.length || 0) / 1365)}KB]`))
        .join("\n");
      await sql`insert into agent_runs (case_id, agent, model, input_tok, output_tok, latency_ms, cost_usd, ok, error,
                  system_prompt, input_payload, raw_output)
        values (${opts.caseId}, ${opts.agent}, ${MODEL}, ${usage.input_tokens || 0},
                ${usage.output_tokens || 0}, ${latency}, ${cost}, ${!err && !!json}, ${err},
                ${trace ? opts.system + JSON_RULE : null},
                ${trace ? asText.slice(0, 60000) : null},
                ${trace ? raw.slice(0, 60000) : null})`;
    } catch {}
  }

  if (err) throw new Error(`${opts.agent}: ${err}`);
  if (!json) {
    throw new Error(truncated
      ? `${opts.agent}: the reply was cut off at the token limit before the JSON closed, even at ${budget} tokens. Shorten what the agent is asked to return.`
      : `${opts.agent}: could not read a JSON object out of the reply. First 200 characters: ${raw.slice(0, 200)}`);
  }
  return { json, raw, usage, latency, cost, truncated, attempts };
}
