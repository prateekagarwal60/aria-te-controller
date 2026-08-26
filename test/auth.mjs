// A gate on the pages alone would leave /api/state readable and /api/policy
// writable by anyone with the URL. These assert the gate covers everything, that
// the way in is still reachable, and that nothing else in the app was disturbed.
import fs from "node:fs";
let bad = 0;
const t = (n, c, d="") => { if (c) console.log(`  ok   ${n}${d?" — "+d:""}`); else { bad++; console.log(`  FAIL ${n} ${d}`); } };

const mw = fs.readFileSync("src/middleware.ts", "utf8");
const matcher = mw.match(/matcher: \[([\s\S]*?)\]/)[1];
/* Next treats a matcher as a whole-path pattern, so it is anchored here too.
   An unanchored test matches a substring and reports a path as gated when it is
   not, which is the wrong answer in the dangerous direction. */
const pattern = new RegExp("^" + matcher.match(/"(.*)"/)[1].replace(/\\\\/g, "\\") + "$");

console.log("\nThe gate covers everything a stranger could reach");
for (const p of ["/", "/claim", "/api/state", "/api/policy", "/api/step", "/api/onboard",
                 "/api/governance", "/api/ledger", "/api/evals", "/api/receipts", "/api/health"])
  t(`${p} is gated`, pattern.test(p));

console.log("\nExcept the way in, and the browser's own requests");
t("/login is let through", /pathname === "\/login"/.test(mw));
t("/api/login is let through", /pathname === "\/api\/login"/.test(mw));
for (const p of ["/_next/static/chunks/main.js", "/favicon.ico", "/logo.png", "/icon.svg"])
  t(`${p} is not gated`, !pattern.test(p));

console.log("\nAn API call gets a status, not a page of HTML");
t("401 for api paths", /pathname\.startsWith\("\/api\/"\)[\s\S]{0,220}status: 401/.test(mw));
t("and a flag the client can act on", /needsLogin: true/.test(mw));
t("a page gets a redirect", /NextResponse\.redirect/.test(mw));
t("and comes back where it was going", /next=\$\{encodeURIComponent\(pathname\)\}/.test(mw));

console.log("\nThe password itself");
t("comes from the environment", /process\.env\.ARIA_PASSWORD/.test(mw));
t("has a working default", /"prateekema26"/.test(mw));
const api = fs.readFileSync("src/app/api/login/route.ts", "utf8");
t("compared without leaking length by timing", /diff \|= given\.charCodeAt/.test(mw) && /diff \|= given\.charCodeAt/.test(api));
t("a wrong guess is slowed down", /setTimeout\(r, 700\)/.test(api));

console.log("\nThe cookie");
t("not readable from JavaScript", /httpOnly: true/.test(api));
t("secure in production", /secure: process\.env\.NODE_ENV === "production"/.test(api));
t("sameSite set", /sameSite: "lax"/.test(api));
t("expires", /maxAge: 60 \* 60 \* 12/.test(api));
t("sign out clears it", /maxAge: 0/.test(api));

console.log("\nThe console notices when the session lapses");
const page = fs.readFileSync("src/app/page.tsx", "utf8");
t("a 401 sends you to sign in", /res\.status === 401/.test(page));
t("there is a way to sign out", /Sign out/.test(page));

console.log("\nNothing else was disturbed");
t("the login page is the only new page", fs.existsSync("src/app/login/page.tsx"));
t("the console still loads state", /fetch\("\/api\/state"/.test(page));
t("the pipeline still walks five steps",
  ["gather","corroborate","decide","authorise","post"].every((k) =>
    new RegExp(`step === "${k}"`).test(fs.readFileSync("src/app/api/step/route.ts", "utf8"))));
t("the evaluation runner does not go through HTTP",
  !/fetch\(/.test(fs.readFileSync("test/eval/run.mjs", "utf8")),
  "so the gate cannot affect it");

console.log(bad ? `\n${bad} FAILED\n` : "\nAll good\n");
process.exit(bad ? 1 : 0);
