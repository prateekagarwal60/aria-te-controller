"use client";
import React, { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Could not reach the server." }));
    setBusy(false);
    if (!r.ok) { setErr(r.error || "That is not the password."); return; }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next;
  };

  return (
    <div className="min-h-screen bg-ink grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-paper mb-5">
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-55">Travel and Expense</div>
          <h1 className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            Sign in
          </h1>
        </div>
        <div className="paper p-5">
          <label className="block">
            <div className="text-[10px] uppercase tracking-[0.14em] text-graphite font-semibold mb-1">
              Password
            </div>
            <input
              type="password" autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full border border-rule bg-white px-2 py-1.5 text-[13px] rounded-sm"
            />
          </label>
          {err && <p className="text-[12.5px] text-flagged mt-2">{err}</p>}
          <button
            onClick={submit} disabled={busy || !password}
            className="mt-4 w-full bg-ink text-paper border border-ink rounded-sm px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
