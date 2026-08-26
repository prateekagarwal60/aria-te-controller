// The health hint tells you where to look when a call fails. A hint that points
// at the wrong thing is worse than none, so the matching is asserted directly.
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const hintFor = (m) =>
  /temperature/i.test(m) ? "temperature"
  : /prefill|assistant message/i.test(m) ? "prefill"
  : /authentication|invalid.*api.?key|401|unauthor/i.test(m) ? "key"
  : /not_found_error|model.*not.*(found|exist)|unknown model/i.test(m) ? "model"
  : /rate.?limit|429/i.test(m) ? "ratelimit"
  : /credit|billing|quota/i.test(m) ? "credit"
  : "none";

console.log("\nReal error strings map to the right cause");
const cases = [
  ["`temperature` is deprecated for this model.", "temperature",
   "the word 'model' appears here; an earlier version reported a wrong model name"],
  ["This model does not support assistant message prefill. The conversation must end with a user message.", "prefill",
   "also contains 'model'"],
  ["404 {\"type\":\"error\",\"error\":{\"type\":\"not_found_error\",\"message\":\"model: claude-nope\"}}", "model"],
  ["401 authentication_error: invalid x-api-key", "key"],
  ["429 rate_limit_error: number of requests has exceeded your rate limit", "ratelimit"],
  ["400 Your credit balance is too low to access the Anthropic API.", "credit"],
  ["Connection error.", "none"],
];
for (const [msg, want, why] of cases) {
  const got = hintFor(msg);
  t(`${want.padEnd(11)} <- ${msg.slice(0, 58)}`, got === want, why ? `${why}${got !== want ? `, got ${got}` : ""}` : (got !== want ? `got ${got}` : ""));
}

console.log("\nOrder matters, not just the patterns");
t("temperature wins over the bare word model", hintFor("`temperature` is deprecated for this model.") === "temperature");
t("prefill wins over the bare word model", hintFor("This model does not support assistant message prefill.") === "prefill");
t("a genuine 404 still reaches the model hint", hintFor("not_found_error") === "model");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
