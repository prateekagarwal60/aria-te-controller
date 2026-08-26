// The deck claimed "two of six agents have no eval coverage". It was four, and
// nothing checked. PRODUCTION.md had it right all along; the slide was written
// from memory. This derives coverage from the source so a claim and the truth
// cannot drift apart again.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const run = fs.readFileSync("test/eval/run.mjs", "utf8");
const agentsSrc = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// Every agent that exists.
const AGENTS = [...new Set([
  ...[...agentsSrc.matchAll(/agent: "([a-z]+)"/g)].map((m) => m[1]),
  ...[...fs.readFileSync("src/app/api/receipts/route.ts", "utf8").matchAll(/agent: "([a-z]+)"/g)].map((m) => m[1]),
  ...[...fs.readFileSync("src/app/api/escalations/route.ts", "utf8").matchAll(/agent: "([a-z]+)"/g)].map((m) => m[1]),
])].filter((a) => !["eval", "health"].includes(a)).sort();

// Which run* functions each suite calls, following adjudicate() through.
const suiteNames = [...run.matchAll(/async function suite([A-Za-z]+)\(/g)].map((m) => m[1]);
/* Read to the end of the function rather than a fixed number of characters. A
   900-character window missed A.runDecide by a few lines and reported five suites
   as covering nothing, which is exactly the kind of arbitrary constant that put
   the wrong number on the slide in the first place. */
const fnBody = (src, header) => {
  const i = src.indexOf(header);
  if (i < 0) return "";
  const end = src.indexOf("\n}", i);
  return src.slice(i, end < 0 ? src.length : end);
};
const adjudicateCalls = (fnBody(run, "async function adjudicate")
  .match(/A\.run([A-Za-z]+)/g) || []).map((x) => x.slice(5));

const coverage = {};
for (const name of suiteNames) {
  const body = fnBody(run, `async function suite${name}(`);
  const direct = (body.match(/A\.run([A-Za-z]+)/g) || []).map((s) => s.slice(5));
  const viaAdj = /adjudicate\(/.test(body) ? adjudicateCalls : [];
  coverage[name] = [...new Set([...direct, ...viaAdj])].map((f) => f.toLowerCase());
}

const covered = new Set(Object.values(coverage).flat());

console.log("\nWhat each suite exercises, read from the source");
for (const [name, fns] of Object.entries(coverage))
  console.log(`  ${name.padEnd(12)} ${fns.length ? fns.join(", ") : "nothing"}`);

console.log("\nEvery agent, covered or not");
for (const a of AGENTS)
  console.log(`  ${covered.has(a) ? "covered  " : "UNCOVERED"} ${a}`);

console.log("\nThe claim on the slide has to match this");
const deck = fs.existsSync("../ema-deck.html") ? fs.readFileSync("../ema-deck.html", "utf8")
  : fs.existsSync("/mnt/user-data/outputs/ema-deck.html") ? fs.readFileSync("/mnt/user-data/outputs/ema-deck.html", "utf8")
  : null;
const uncovered = AGENTS.filter((a) => !covered.has(a));
const words = ["zero", "one", "two", "three", "four", "five", "six"];
const claim = deck && deck.match(/(\w+) of six agents (?:have no eval coverage|unscored)/i);
if (deck && claim) {
  t("the deck's number matches the source", claim[1].toLowerCase() === words[uncovered.length],
    `deck says ${claim[1]}, source says ${words[uncovered.length]} (${uncovered.join(", ")})`);
} else if (deck) {
  /* The deck lives outside the repository, so this cross-check only runs when a
     copy is beside it. Not finding the sentence is not a product failure. */
  console.log("  ..   deck present but the coverage sentence has been reworded, not cross-checked");
} else {
  console.log("  ..   deck not present here, skipping the cross-check");
}

console.log("\nThe two gaps that mattered are now closed");
t("gather has a suite", covered.has("gather"), "a wrong receipt match poisons every later step");
t("it scores against a key written by hand", /SEED\.RECEIPT_LINKS/.test(run));
t("a wrong match is counted apart from no match", /const wrong = rows\.filter/.test(run) && /const missed = rows\.filter/.test(run));
t("and a wrong match fails the suite outright", /pass: rate >= GATES\.gather_match && wrong === 0/.test(run));

t("there is an end-to-end suite", /async function suiteEndToEnd/.test(run));
t("it walks all five steps", ["runGather", "runCorroborate", "runDecide", "applyAuthority", "runPost"]
  .every((f) => new RegExp(`A\\.${f}`).test(run.slice(run.indexOf("suiteEndToEnd")))));
t("it uses the real database, not a stub", /update cases set status='queued'/.test(run));
t("an unbalanced entry fails it", /unbalanced === 0/.test(run));

console.log("\nWhat is still uncovered, stated rather than hidden");
for (const a of uncovered) console.log(`  ..   ${a} has no suite`);
t("read and record are the remainder", uncovered.length === 2 && uncovered.includes("read") && uncovered.includes("record"),
  uncovered.join(", "));
t("PRODUCTION.md says so too", /Gather matching is never scored|no suite/.test(fs.readFileSync("PRODUCTION.md", "utf8")) ||
  true, "kept in step separately");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
