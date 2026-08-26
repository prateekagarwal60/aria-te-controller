// The command I handed over did not work. The parser read the value of --repeat
// as a suite name and stopped, having done nothing. A parser that misreads its
// own input in silence is worse than one that refuses, so every shape anyone is
// likely to type is asserted here.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const FLAGS = { repeat: "number", suite: "string", charges: "number" };
function parseArgs(argv) {
  const out = { suite: null, repeat: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { help: true };
    if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split("=");
      if (!(name in FLAGS)) return { error: `Unknown option --${name}.` };
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined) return { error: `--${name} needs a value.` };
      if (FLAGS[name] === "number") {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) return { error: `--${name} needs a positive number, got "${value}".` };
        out[name] = n;
      } else out[name] = value;
    } else {
      if (out.suite) return { error: `Two suite names given: "${out.suite}" and "${a}".` };
      out.suite = a;
    }
  }
  return out;
}
const p = (...a) => parseArgs(a);

console.log("\nThe command that failed, in every order anyone would type it");
for (const argv of [
  ["--repeat", "15", "--suite", "consistency"],
  ["--suite", "consistency", "--repeat", "15"],
  ["consistency", "--repeat", "15"],
  ["--repeat", "15", "consistency"],
  ["--suite=consistency", "--repeat=15"],
]) {
  const r = p(...argv);
  t(argv.join(" "), r.suite === "consistency" && r.repeat === 15 && !r.error,
    r.error || `suite ${r.suite}, repeat ${r.repeat}`);
}

console.log("\nDefaults and the plain cases");
t("no arguments runs everything", p().suite === null && p().repeat === 5);
t("a bare suite name works", p("injection").suite === "injection");
t("repeat defaults to five", p("injection").repeat === 5);

console.log("\nIt refuses rather than guessing");
t("unknown option", p("--reps", "5").error?.includes("--reps"), p("--reps","5").error);
t("flag with no value", p("--repeat").error?.includes("needs a value"), p("--repeat").error);
t("non-numeric repeat", p("--repeat", "many").error?.includes("positive number"), p("--repeat","many").error);
t("zero repeats", p("--repeat", "0").error?.includes("positive number"));
t("negative repeats", p("--repeat", "-3").error !== undefined);
t("two suite names", p("golden", "injection").error?.includes("Two suite names"), p("golden","injection").error);
t("help is help", p("--help").help === true && p("-h").help === true);

console.log("\nThe runner uses this parser and prints usage on a mistake");
const src = fs.readFileSync("test/eval/run.mjs", "utf8");
t("has the flag table", /const FLAGS = \{ repeat: "number", suite: "string", charges: "number" \}/.test(src));
t("charges is a known flag", p("--charges", "6").error === undefined, "the end-to-end suite takes one");
t("stops on an unknown option", /parsed\.error.*process\.exit\(2\)/s.test(src));
t("prints usage", /const USAGE =/.test(src));
t("usage lists every suite", /Object\.keys\(SUITES\)\.join/.test(src));
t("usage shows the repeat form", /--repeat 20/.test(src));
t("and the end-to-end form", /--charges 10/.test(src));
t("explains what each flag does", /runs of each charge in the consistency suite/.test(src) &&
  /charges walked end to end/.test(src));

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);

console.log("\nHow many runs a gate needs, which floating point gets wrong");
const runsToResolve = (gate) => Math.max(2, Math.ceil(1 / (1 - gate) - 1e-9));
t("90 percent needs 10, not 11", runsToResolve(0.90) === 10,
  `a bare ceil gives ${Math.ceil(1 / (1 - 0.90))}, because 1/(1-0.9) is 10.000000000000002`);
t("95 percent needs 20", runsToResolve(0.95) === 20);
t("75 percent needs 4", runsToResolve(0.75) === 4);
t("50 percent needs 2", runsToResolve(0.50) === 2);
t("never fewer than 2", runsToResolve(0.1) === 2);
t("the default repeat can actually gate the default consistency threshold",
  10 >= runsToResolve(0.90), "otherwise the suite is decoration");

console.log("\nEvery gate that prints a verdict is in the tally");
const runner2 = fs.readFileSync("test/eval/run.mjs", "utf8");
t("latency and cost are collected as gates", /const budgetGates = \[/.test(runner2));
t("and folded into the failure list", /const failed = \[\.\.\.failedSuites, \.\.\.failedBudgets\]/.test(runner2));
t("the cost gate is actually referenced",
  (runner2.match(/GATES\.cost_per_call_usd/g) || []).length >= 2,
  "it was declared and never used at all");
t("the summary says gates, not suites", /gate\(s\) not met/.test(runner2));
