import { NextResponse } from "next/server";

export const runtime = "nodejs";

function expected() {
  return process.env.ARIA_PASSWORD || "prateekema26";
}

function matches(given: string, want: string) {
  if (!given || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!matches(String(password || ""), expected())) {
    // A pause, so the form cannot be hammered quickly.
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ ok: false, error: "That is not the password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "aria_pass",
    value: expected(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: "aria_pass", value: "", path: "/", maxAge: 0 });
  return res;
}
