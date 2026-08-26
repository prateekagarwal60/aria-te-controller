// Charges are independent, so working them one at a time was a choice nobody made
// deliberately. These assert the parallel run keeps the order that matters and
// drops the order that does not.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const page = fs.readFileSync("src/app/page.tsx", "utf8");
const route = fs.readFileSync("src/app/api/step/route.ts", "utf8");

console.log("\nSteps within a charge stay in order");
const chain = { gather: "corroborate", corroborate: "decide", decide: "authorise" };
for (const [from, to] of Object.entries(chain)) {
  const seg = route.slice(route.indexOf(`step === "${from}"`), route.indexOf(`step === "${from}"`) + 1400);
  t(`${from} still hands to ${to}`, new RegExp(`next: "${to}"`).test(seg));
}
t("authorise still hands to post", /next: "post", outcome: "approved"/.test(route));
t("the client follows whatever the server says next", /step = r\.next;/.test(page),
  "so the order is decided in one place");

console.log("\nCharges run alongside each other");
t("a fixed number at once", /const AT_ONCE = 4/.test(page));
t("workers pull from a shared index", /const i = next\+\+/.test(page));
t("no worker runs past the end", /if \(i >= queued\.length\) return/.test(page));
t("never more workers than charges", /Math\.min\(AT_ONCE, queued\.length\)/.test(page));
t("stopping is checked inside the loop", /while \(!stopRef\.current\)/.test(page));

// The scheduler, run directly.
async function schedule(n, atOnce) {
  const items = Array.from({ length: n }, (_, i) => i);
  const startedAt = [];
  let next = 0, live = 0, peak = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      live++; peak = Math.max(peak, live);
      startedAt.push(i);
      await new Promise((r) => setTimeout(r, 1));
      live--;
    }
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, worker));
  return { peak, ran: startedAt.length, unique: new Set(startedAt).size };
}
const r18 = await schedule(18, 4);
t("every charge runs exactly once", r18.ran === 18 && r18.unique === 18);
t("never more than four at a time", r18.peak <= 4, `peaked at ${r18.peak}`);
const r2 = await schedule(2, 4);
t("two charges do not start four workers", r2.peak <= 2 && r2.ran === 2);
const r0 = await schedule(0, 4);
t("an empty queue does nothing", r0.ran === 0);

console.log("\nThe screen shows progress rather than one charge's steps");
t("a progress bar while several are in flight", /Working \{AT_ONCE\} at a time/.test(page));
t("counts finished against total", /\{progress\.done\} of \{progress\.total\}/.test(page));
t("the per charge strip still shows for a single Run", /pipe\.caseId \?/.test(page));
t("state is reloaded once at the end, not per charge",
  /if \(refresh\) await load\(\);/.test(page), "four reloads a second would be worse than the wait");

console.log("\nA stopped run still says why");
t("the banner survives a parallel run", /setStopped\(\{ caseId, step, error/.test(page));
t("and is cleared when a new run starts", /setBusy\(true\); setStopped\(null\);/.test(page));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
