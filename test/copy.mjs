// Copy written to answer a question during the build is not copy a customer
// should read. This scans every surface an external user sees for the tells.
import fs from "node:fs";

// Agents is behind a dev toggle and is for whoever owns the product, so it is
// deliberately excluded.
const SURFACES = [
  "src/app/page.tsx", "src/app/claim/page.tsx",
  "src/components/Workpaper.tsx", "src/components/EvidenceFile.tsx",
  "src/components/TrustStrip.tsx", "src/components/Trace.tsx",
  "src/components/Onboarding.tsx", "src/components/ui.tsx",
];

const BANNED = [
  [/npm (run |test)/, "a terminal command"],
  [/\bgolden set\b/i, "internal name for the answer key"],
  [/\bcorpus\b/i, "internal word for the charge history"],
  [/\bseeded\b/i, "reveals demo data as demo data"],
  [/\bSQL\b/, "implementation detail"],
  [/\bin code\b/i, "implementation detail"],
  [/\bthe model\b/i, "she is presented as an employee, not a model"],
  [/\bprompt\b/i, "implementation detail"],
  [/\bnot calibrated\b/i, "a build note, not customer copy"],
  [/\bchosen by hand\b/i, "a build note"],
  [/\bis a guess\b/i, "a build note"],
  [/\bwhich is why\b/i, "explains a design choice rather than the product"],
  [/\badd it up yourself\b/i, "written for the person who built it"],
  [/\bnot decoration\b/i, "defends a design choice"],
  [/\beval\b/i, "internal name for the review"],
  [/\bhardcoded\b/i, "implementation detail"],
  /* The first pass looked only for jargon and let through whole sentences aimed
     at whoever was testing the thing rather than using it. */
  [/\bmake one up\b/i, "instructions to a tester"],
  [/\bworth trying\b/i, "instructions to a tester"],
  [/\bawkward cases\b/i, "instructions to a tester"],
  [/\bwatch it go through\b/i, "instructions to a tester"],
  [/\bfive steps\b/i, "the pipeline is ours, not theirs"],
  [/\bfixture\b/i, "implementation detail"],
  [/\bshipped with the product\b/i, "a vendor talking about itself"],
  [/\brun by us\b|\bbefore a release\b/i, "a vendor asking to be believed"],
  [/\bA person&rsquo;s reading\b|\bone person's reading\b/i, "an argument about method, not a fact about their charges"],
  [/\bthis product\b|\bthe product\b/i, "the product should not refer to itself"],
];

// Strings only. Comments are for whoever maintains this and are left alone.
function visibleText(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");
  const out = [];
  for (const m of noLine.matchAll(/"([^"\\]{25,})"|'([^'\\]{25,})'|>([^<>{}]{25,})</g))
    out.push(m[1] || m[2] || m[3]);
  for (const m of noLine.matchAll(/`([^`$]{25,})`/g)) out.push(m[1]);
  return out;
}

let bad = 0;
console.log("\nEvery surface a customer sees");
for (const f of SURFACES) {
  const strings = visibleText(fs.readFileSync(f, "utf8"));
  const hits = [];
  for (const s of strings)
    for (const [re, why] of BANNED)
      if (re.test(s)) hits.push({ s: s.trim().replace(/\s+/g, " ").slice(0, 70), why });
  if (hits.length) {
    bad += hits.length;
    console.log(`  FAIL ${f}`);
    for (const h of hits) console.log(`       "${h.s}"\n         ${h.why}`);
  } else {
    console.log(`  ok   ${f.split("/").slice(-1)[0]} — ${strings.length} strings, nothing written for the builder`);
  }
}

console.log("\nThe builder's screen is excluded on purpose");
const page = fs.readFileSync("src/app/page.tsx", "utf8");
console.log(`  ok   Agents is behind a dev toggle: ${/DEV_VIEWS/.test(page) ? "yes" : "NO"}`);
if (!/DEV_VIEWS/.test(page)) bad++;

console.log(bad ? `\n${bad} phrase(s) to rewrite\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
