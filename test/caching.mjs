// An edge network kept a copy of the queue and served it back after the database
// had been emptied, so eighteen charges appeared on a screen whose database held
// none. Every API response now refuses to be cached.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const helper = fs.readFileSync("src/lib/fresh.ts", "utf8");
console.log("\nThe headers that stop it");
for (const [name, needle] of [
  ["browsers and proxies", /Cache-Control".*no-store/],
  ["any CDN", /CDN-Cache-Control".*no-store/],
  ["Vercel's edge specifically", /Vercel-CDN-Cache-Control".*no-store/],
  ["older proxies", /Pragma".*no-cache/],
]) t(name, needle.test(helper));
t("and it records why", /put eighteen\s*\n?\s*\*?\s*charges on a screen whose database held none/.test(helper));

console.log("\nEvery route uses it");
const routes = fs.readdirSync("src/app/api", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `src/app/api/${d.name}/route.ts`)
  .filter((p) => fs.existsSync(p));
let missing = 0;
for (const p of routes) {
  const s = fs.readFileSync(p, "utf8");
  if (!/NextResponse\.json\(|fresh\(/.test(s)) continue;
  const usesRaw = /NextResponse\.json\(/.test(s);
  const usesFresh = /\bfresh\(/.test(s) && /from "@\/lib\/fresh"/.test(s);
  if (usesRaw || !usesFresh) { missing++; console.log(`  FAIL ${p.split("/")[3]} ${usesRaw ? "still returns NextResponse.json" : "does not import fresh"}`); bad++; }
}
t(`all ${routes.length} routes return uncacheable JSON`, missing === 0);

console.log("\nThe screens that must never show stale data");
for (const r of ["state", "step", "escalations", "ledger", "governance", "review"]) {
  const p = `src/app/api/${r}/route.ts`;
  if (!fs.existsSync(p)) continue;
  t(`/api/${r}`, /from "@\/lib\/fresh"/.test(fs.readFileSync(p, "utf8")));
}

console.log("\nAnd the setup route can be reached from a browser");
const boot = fs.readFileSync("src/app/api/bootstrap/route.ts", "utf8");
t("GET is handled", /export async function GET\(\)/.test(boot),
  "a deployment on an empty database had no way for a person to set it up");
t("it does the same work as POST", /return POST\(\);/.test(boot));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
