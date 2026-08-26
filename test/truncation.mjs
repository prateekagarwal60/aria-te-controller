// Two suites failed with "could not read a JSON object" when the real cause was
// the reply being cut off at the token limit. That sends you to the parser
// instead of the budget. Asserted here against the actual source.
import fs from "node:fs";
import { extractJson } from "../.evalbuild/anthropic.mjs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

console.log("\nA truncated reply is unparseable, which is why it looked like a parser fault");
const cut = '{"verdict":"APPROVE","confidence":0.9,"reasoning":"The room rate is within the cap and the receipt';
t("brace matching correctly returns nothing", extractJson(cut) === null);
t("the same object closed parses fine", extractJson(cut + '."}')?.verdict === "APPROVE");

console.log("\nThe client distinguishes the two");
const src = fs.readFileSync("src/lib/anthropic.ts", "utf8");
t("reads stop_reason", /stop_reason === "max_tokens"/.test(src));
t("doubles the budget and retries rather than asking for a repair",
  /budget = Math\.min\(budget \* 2/.test(src));
t("caps the budget so it cannot run away", /8000/.test(src));
t("allows three attempts", /attempt < 3/.test(src));
t("says 'cut off at the token limit' when that is what happened",
  /cut off at the token limit/.test(src));
t("shows the first characters when it is genuinely unparseable",
  /First 200 characters/.test(src));
t("the two messages are different", 
  src.includes("cut off at the token limit") && src.includes("could not read a JSON object"));

console.log("\nBudgets were raised for the two agents that were truncating");
const agents = fs.readFileSync("src/lib/agents/index.ts", "utf8");
const budget = (name) => {
  const i = agents.indexOf(`agent: "${name}"`);
  const m = agents.slice(i, i + 600).match(/maxTokens:\s*(\d+)/);
  return m ? Number(m[1]) : null;
};
t("decide has room for sixteen fields of prose and quotes", budget("decide") >= 5000,
  `${budget("decide")} tokens`);
t("post has room for a multi-line foreign folio", budget("post") >= 4000, `${budget("post")} tokens`);
/* A budget has to survive its own retry. Post doubled from 2,400 to 4,800 and
   still ran out on a Singapore folio with a tax split. */
t("and doubling it once clears what actually failed", budget("post") * 2 >= 8000,
  `${budget("post") * 2} on the retry`);

console.log("\nCost is carried out of the agents, so a run cannot report spending nothing");
t("decide returns its cost", /json\.eval_cost = _cost/.test(agents));
t("post returns its cost", /eval_cost: postCost/.test(agents));
const runner = fs.readFileSync("test/eval/run.mjs", "utf8");
t("the runner reads it", /out\.eval_cost/.test(runner), "it was hardcoded to 0");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
