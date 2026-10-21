"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/report";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="centerwrap">
      <form className="authcard" onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 16px" }}>
          <span className="dot" />
          MealLens
        </div>
        <p className="lead" style={{ marginTop: 0 }}>
          Sign in with your DispatchLens account.
        </p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="inp"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="inp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && (
          <p style={{ color: "var(--bad)", fontSize: 13, margin: "0 0 12px" }}>{err}</p>
        )}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="centerwrap">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
