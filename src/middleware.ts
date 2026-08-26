import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Nothing is reachable without the password. Pages and API routes alike, because
 * a gate on the pages alone leaves /api/state readable by anyone with the URL and
 * /api/policy writable by them.
 *
 * This is a shared password on a public demo, not an identity system. It keeps
 * strangers out. It does not tell you who did what, and the product still records
 * every decision against one Controller. Real authentication is the first thing to
 * build before a customer, and this is not it.
 */

const COOKIE = "aria_pass";

function expected() {
  return process.env.ARIA_PASSWORD || "prateekema26";
}

/** Same length comparison, so a wrong guess takes the same time as a right one. */
function matches(given: string | undefined, want: string) {
  if (!given || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page and the endpoint that sets the cookie have to stay reachable,
  // or there is no way in.
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (matches(req.cookies.get(COOKIE)?.value, expected())) return NextResponse.next();

  // An API call gets a status it can act on rather than a redirect into HTML.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Not signed in.", needsLogin: true },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and the icons a browser asks for unprompted.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
