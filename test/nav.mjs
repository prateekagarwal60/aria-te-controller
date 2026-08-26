// Moving three screens behind Settings is the kind of change that silently orphans
// one of them. These assert every screen is still reachable, every component is
// still rendered somewhere, and nothing daily was buried.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };
const page = fs.readFileSync("src/app/page.tsx", "utf8");

const navBlock = page.slice(page.indexOf("const VIEWS = ["), page.indexOf("] as const;", page.indexOf("const VIEWS = [")));
const nav = [...navBlock.matchAll(/\["([a-z]+)", "([^"]+)"\]/g)].map((m) => ({ key: m[1], label: m[2] }));
const setBlock = page.slice(page.indexOf("const SETTINGS_SECTIONS = ["), page.indexOf("] as const;", page.indexOf("const SETTINGS_SECTIONS = [")));
const settings = [...setBlock.matchAll(/\["([a-z]+)", "([^"]+)"/g)].map((m) => ({ key: m[1], label: m[2] }));

console.log("\nThe nav is the work you do daily");
t("six items", nav.length === 6, nav.map((n) => n.label).join(", "));
for (const label of ["Queue", "Escalations", "Ledger", "Precedents", "Manual entry", "Settings"])
  t(`"${label}" is in the nav`, nav.some((n) => n.label === label));
for (const label of ["Controls", "Authority", "Evaluation", "Policy"])
  t(`"${label}" is no longer a peer of the queue`, !nav.some((n) => n.label === label),
    label === "Policy" ? "it is configuration too" : "");

console.log("\nConfiguration is behind one door, and all of it is there");
t("four sections", settings.length === 4, settings.map((s) => s.label).join(", "));
for (const key of ["policy", "terms", "governance", "evals"])
  t(`${key} is a settings section`, settings.some((s) => s.key === key));
t("each section explains itself", /The limits she works inside/.test(setBlock) && /Which rung she is on/.test(setBlock));

console.log("\nNothing was orphaned by the move");
const dispatched = [...page.matchAll(/view === "([a-z]+)"/g)].map((m) => m[1]);
for (const key of ["desk", "escalations", "ledger", "policy", "precedents", "intake", "settings", "evals", "governance", "terms", "agents"])
  t(`view "${key}" still dispatches`, dispatched.includes(key));
for (const comp of ["Escalations", "Ledger", "Policy", "Precedents", "Evals", "Governance", "Terms", "Intake", "Agents", "Settings"])
  t(`<${comp}> is still rendered`, new RegExp(`<${comp}[\\s/>]`).test(page));

console.log("\nSettings renders each section itself, not only via the old keys");
const shell = page.slice(page.indexOf("function Settings("), page.indexOf("function Line("));
for (const [k, comp] of [["policy", "Policy"], ["terms", "Terms"], ["governance", "Governance"], ["evals", "Evals"]])
  t(`section ${k} renders <${comp}>`, new RegExp(`section === "${k}" && <${comp}`).test(shell));
t("the builder section only appears with the dev flag", /section === "agents" && dev/.test(shell));
t("and is not offered unless dev is on", /\.\.\.\(dev \? \[\["agents"/.test(shell));
t("an unknown section falls back rather than blanking", /\|\| sections\[0\]/.test(shell));

console.log("\nThe confidence histogram is gone");
t("no distribution chart", !/confidence worth anything/i.test(page),
  "a histogram with no answer key drove no action");
t("no calibration bucket rendering", !/width_bucket|calibration\.map/.test(page));
t("and no control was left behind for the confidence floor", !/min_confidence: v/.test(page),
  "it gated a decision on a number nothing had checked");
t("and the eval report still measures it against an answer key",
  /Is the confidence number worth anything/.test(fs.readFileSync("test/eval/run.mjs", "utf8")));

console.log("\nThe state machine was not disturbed");
t("one view state", (page.match(/const \[view, setView\]/g) || []).length === 1);
t("the dev fallback still points at the queue", /if \(!dev && view === "agents"\) setView\("desk"\)/.test(page));
t("the escalation badge still sits on the nav", /counts\.escalated > 0 &&/.test(page));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
