import { fresh } from "@/lib/fresh";
import { sql, newId } from "@/lib/db";
import { think, Block } from "@/lib/anthropic";
import { contentHash } from "@/lib/agents/signals";
import { spendDateFrom } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const EXTRACT_SYSTEM = `You read a receipt and record what it actually says. You do not interpret,
judge or fill gaps. If a field is not printed on the document, return null for it rather than a guess.

Also note anything internally inconsistent, because a later step needs it: arithmetic that does not
add up, tax that does not match the stated rate, a registration number that is absent where the
jurisdiction requires one, line items that do not fit the merchant, an implausible date or time.
Report only what you can point to on the document.

Return JSON:
{
  "merchant": string|null,
  "date": string|null,
  "time": string|null,
  "currency": string|null,
  "subtotal": number|null,
  "tax": number|null,
  "total": number|null,
  "line_items": [{"description": string, "qty": number|null, "amount": number|null}],
  "attendees": number|null,
  "attendee_names": [string],
  "tax_id": string|null,
  "payment_last4": string|null,
  "transcribed_text": string,
  "internal_inconsistencies": [string]
}`;

export async function POST(req: Request) {
  const b = await req.json();
  try {
    const id = newId("R");
    let content: Block[];
    if (b.image_b64) {
      content = [
        { type: "image", source: { type: "base64", media_type: b.media || "image/jpeg", data: b.image_b64 } },
        { type: "text", text: "Read this receipt." },
      ];
    } else if (b.raw_text) {
      content = [{ type: "text", text: `Read this receipt.\n\n${b.raw_text}` }];
    } else {
      return fresh({ ok: false, error: "Send an image or receipt text." }, { status: 400 });
    }

    const { json } = await think({ agent: "read", system: EXTRACT_SYSTEM, content, maxTokens: 2000 });
    const text = json.transcribed_text || b.raw_text || "";
    const hash = contentHash(text);

    const prior: any = await sql`select id, employee_id, created_at from receipts where content_hash = ${hash}`;

    /* The date on the document, not the date it arrived. What the extractor
       found if it found one, otherwise read from the text. */
    const found = json?.date;
    const spend = (typeof found === "string" && /^\d{4}-\d{2}-\d{2}$/.test(found))
      ? found : spendDateFrom(text);
    await sql`insert into receipts (id, employee_id, source, raw_text, image_b64, image_media, extracted, content_hash, spend_date)
      values (${id}, ${b.employee_id}, ${b.image_b64 ? "upload" : "email"}, ${text},
              ${b.image_b64 ? String(b.image_b64).slice(0, 400000) : null}, ${b.media || null},
              ${JSON.stringify(json)}, ${hash}, ${spend})`;

    return fresh({ ok: true, id, extracted: json, priorSubmissions: prior });
  } catch (e: any) {
    return fresh({ ok: false, error: e.message }, { status: 200 });
  }
}
