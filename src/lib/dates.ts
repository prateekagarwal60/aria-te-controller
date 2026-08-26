/**
 * The date printed on a document, read from its own text.
 *
 * Receipt matching used to filter on when a row arrived in the database. A
 * receipt uploaded three weeks after a trip, or a corpus loaded after the fact,
 * then fell outside the window and never matched its own charge.
 *
 * This lives on its own rather than beside the sample corpus, so a production
 * route that needs it does not pull a demo dataset in with it.
 */
export function spendDateFrom(text: string): string | null {
  if (!text) return null;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(20\d{2})\b/);
  if (dmy) {
    const m = months[dmy[2].toLowerCase()];
    if (m) return `${dmy[3]}-${m}-${String(dmy[1]).padStart(2, "0")}`;
  }
  return null;
}
