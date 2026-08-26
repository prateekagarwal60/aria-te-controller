// Printed at the end of npm test. If you cannot say what a suite covers, the
// suite is not doing its job.
const COVERED = [
  ["sqlcheck",  "Every query shape the app sends, run against a real Postgres. Includes the exact parameterised windows, because a literal carries its type and a parameter does not."],
  ["sqlscan",   "All 145 SQL literals extracted from source and executed. Catches a query that typechecks, builds, and only fails when Postgres resolves an operator."],
  ["json",      "Pulling a JSON object out of a model reply: fenced, with a preamble, with a trailing sentence, with braces inside quoted policy text. And returning nothing rather than guessing when there is nothing there."],
  ["hints",     "The health check maps a real error string to the right cause. An earlier version matched the word 'model' and sent you looking in the wrong place."],
  ["guardrails","PII redaction (cards, Aadhaar, PAN, IBAN, email, phone) and the vendor GSTIN that is deliberately kept. Citation verification, including that an altered figure is rejected. The hash chain, including that editing, reordering or deleting an entry breaks it."],
  ["trust",     "Every state of the six checks a Controller sees, and the risk arithmetic including its boundaries."],
  ["harness",   "The eval harness builds the same input production builds. It once did not, and 23 cases failed for a reason that had nothing to do with the model."],
  ["evalready", "The eval runner creates whatever a fresh database is missing, never runs twice, and never overwrites a customer's own policy."],
  ["scoring",   "What every headline number means. A partial allowance is not money out of the door, and an injection may never buy a better outcome or a larger amount."],
  ["truncation","A reply cut off at the token limit is reported as truncation and retried with a larger budget, not blamed on the parser."],
  ["args",      "Every shape of command anyone would plausibly type. The suite name was once read from the value of a flag, so a run did nothing and reported no suite called 15."],
  ["verdict",   "The outcome label is arithmetic over the amounts, not a name the model picks. It used to have three names for four outcomes and returned a different one each run on identical reasoning."],
  ["frozen",    "The answer key is frozen behind a register of standing disagreements. It was edited three rounds running while its score swung forty points."],
  ["display",   "A partial settlement shows what was allowed, not what was charged. An uploaded receipt is linked rather than copied, so the reuse check stopped firing against the person who uploaded it once."],
  ["upgrade",   "A database already in use survives a schema update: every row kept, worked outcomes intact, new columns added empty, and a setting you changed is not overwritten by a new default."],
  ["copy",      "Every surface a customer sees, scanned for language written to answer a question during the build rather than to serve the person reading it."],
  ["auth",      "The password covers pages and API routes alike. A gate on the pages alone would leave the state readable and the policy writable by anyone with the URL."],
  ["value",     "The headline is what she saved, not what she cost. Money stopped is measured; time is an assumption printed beside the figure. Cost survives only as a daily brake under Controls."],
  ["assurance", "Why the charges nobody opened can be left alone, and a way for a human to test that. Escalation accuracy counts both asking when she need not have and deciding when she should have asked."],
  ["queue",     "Charges run four at a time while the steps within a charge stay in order. Every charge runs exactly once and stopping still works."],
  ["nav",       "Every screen is still reachable after configuration moved behind Settings, and no component was orphaned by the move."],
  ["migrate",   "A database from an older build receives the columns it is missing. Applying the schema only after a query failed meant everything added since the first bootstrap silently did not exist."],
  ["startup",   "Two startups arriving at once share one request. A boolean guard made the second report a failure that had not happened, on a database that was about to be created correctly."],
  ["confidence","The confidence floor is off unless switched on. It gated a decision on a number the model gives itself, which moves by as much as 0.2 on identical input, so a charge near the line settled or escalated at random."],
  ["escalation","She reached a view and needs agreement, or reached none and needs a decision. Storing both the same way made answering a question count as overturning a recommendation, so the figure always read 100 percent."],
  ["gates",     "Every gate is declared before the tally that reads it, and every gate declared is enforced. Three runs completed all their work and then died on a variable used above its declaration."],
  ["coverage",  "Which agents the evaluation actually exercises, derived from the source. A slide claimed two of six were unscored when it was four, because the number was written from memory and nothing checked it."],
  ["matching",  "A receipt is matched on the date printed on it, not the date the row arrived. Filtering on arrival meant five of ten seeded receipts did not match, and a receipt uploaded late never would."],
  ["liveness",  "A row never claims an outcome the workpaper cannot draw. Patching a row's status locally while leaving the decision unpatched made a charge read as settled beside an empty panel."],
  ["caching",   "Every API response refuses to be cached. An edge network kept a copy of the queue and served it back after the database was emptied, so eighteen charges appeared on a screen whose database held none."],
  ["invariance","That the policy-invariance matrix actually discriminates. A matrix where every rulebook expects the same verdict proves nothing and fails here."],
  ["bootstrap", "The onboarding round trip: saved policy, books and people come back in the shape the forms render. Replace replaces. The agent is not hired until commit."],
  ["paths",     "Card charge and reimbursement differ in evidence and in accounting treatment, in the data rather than only in the prose."],
];
console.log("\nWhat npm test covered\n");
console.log("  lint        no-undef across every test and script. Two evaluation runs completed");
console.log("              every model call and then threw on an undeclared variable. TypeScript");
console.log("              does not see these files and an unexecuted branch cannot be tested.");
for (const [n, w] of COVERED) console.log(`  ${n.padEnd(11)} ${w}`);
console.log(`
  All of it is deterministic. No model is called and nothing is spent.
  Judgment is measured separately by npm run eval, which does call the model.
`);
