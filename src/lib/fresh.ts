import { NextResponse } from "next/server";

/** A JSON response no layer between here and the browser may keep a copy of.
 *
 *  Without these headers a CDN is free to serve a saved copy, which put eighteen
 *  charges on a screen whose database held none. Everything here reflects a
 *  database that changes under it, so none of it is ever safe to cache. */
export function fresh(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  return res;
}
