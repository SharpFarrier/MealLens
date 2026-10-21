"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCanteenConfig, localDate } from "@/lib/useConfig";
import {
  activeWindow,
  nextWindow,
  minutesOf,
  fmtTime,
  rateFor,
  itemByKey,
  winStart,
  winEnd,
  type ItemKey,
  type MealWindow,
  type Tier,
} from "@/lib/meals";
import type { EmployeeRow } from "@/lib/types";

type Result = { kind: "ok" | "warn" | "bad"; big: string; name: string; sub: string } | null;

const SUPERVISOR_PIN = process.env.NEXT_PUBLIC_SUPERVISOR_PIN || "2468";

export default function ScanPage() {
  const { items, windows, concessionRate, loading } = useCanteenConfig();
  const [now, setNow] = useState(() => new Date());
  const [actor, setActor] = useState<string>("");
  const [result, setResult] = useState<Result>(null);
  const [chooser, setChooser] = useState<{ emp: EmployeeRow; win: MealWindow } | null>(null);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<string | null>(null); // key for two-tap extra on single-item windows
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setActor(data.user?.email || "staff"));
  }, []);

  const nowMin = minutesOf(now.getHours(), now.getMinutes());
  const win = activeWindow(windows, nowMin);

  const flash = useCallback((r: Result) => {
    setResult(r);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setResult(null), 2600);
  }, []);

  const lookup = useCallback(async (cardId: string): Promise<EmployeeRow | null> => {
    const s = createClient();
    const { data } = await s
      .from("employees")
      .select("*")
      .eq("card_id", cardId.trim())
      .eq("active", true)
      .maybeSingle();
    return (data as EmployeeRow) || null;
  }, []);

  const recordItems = useCallback(
    async (emp: EmployeeRow, win: MealWindow, chosen: ItemKey[], isOverride: boolean) => {
      setBusy(true);
      const s = createClient();
      const meal_date = localDate();
      const tier: Tier = emp.rate_tier;
      // which of the chosen were already taken today (base, non-extra)?
      const { data: existing } = await s
        .from("canteen_scans")
        .select("item_key")
        .eq("employee_id", emp.id)
        .eq("meal_date", meal_date)
        .eq("is_extra", false)
        .in("item_key", chosen);
      const taken = new Set<string>((existing || []).map((r: { item_key: string }) => r.item_key));

      const rows = chosen.map((key) => {
        const item = itemByKey(items, key)!;
        const isExtra = taken.has(key);
        return {
          employee_id: emp.id,
          card_id: emp.card_id,
          item_key: key,
          window_key: win.key,
          meal_date,
          amount: rateFor(item, tier, concessionRate),
          is_extra: isExtra,
          is_override: isOverride,
          actor,
          device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : null,
        };
      });
      const { error } = await s.from("canteen_scans").insert(rows);
      setBusy(false);

      if (error) {
        flash({ kind: "bad", big: "✕", name: emp.name, sub: error.message });
        return;
      }
      const anyExtra = rows.some((r) => r.is_extra);
      const total = rows.reduce((a, r) => a + r.amount, 0);
      const parts = rows
        .map((r) => itemByKey(items, r.item_key as ItemKey)!.label + (r.is_extra ? " (extra)" : ""))
        .join(" + ");
      flash({
        kind: anyExtra ? "warn" : "ok",
        big: isOverride ? "✓" : anyExtra ? "+1" : "✓",
        name: emp.name,
        sub: `${parts} · ₹${total}${isOverride ? " · override" : ""}`,
      });
    },
    [actor, concessionRate, flash, items]
  );

  const handleCard = useCallback(
    async (cardId: string, isOverride = false) => {
      if (!cardId.trim()) return;
      if (!win) {
        const nx = nextWindow(windows, nowMin);
        flash({ kind: "bad", big: "✕", name: cardId, sub: nx ? `Closed. Next: ${nx.name} at ${fmtTime(winStart(nx))}` : "Counter closed" });
        return;
      }
      const emp = await lookup(cardId);
      if (!emp) {
        flash({ kind: "bad", big: "✕", name: cardId, sub: "Card not found or inactive" });
        return;
      }
      if (win.items.length > 1) {
        setChooser({ emp, win });
        return;
      }
      // single item window: two-tap extra confirm
      const key = win.items[0];
      const pkey = emp.id + "|" + key;
      const s = createClient();
      const { data: existing } = await s
        .from("canteen_scans")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("meal_date", localDate())
        .eq("item_key", key)
        .eq("is_extra", false)
        .maybeSingle();
      const item = itemByKey(items, key)!;
      if (existing && pendingRef.current !== pkey) {
        pendingRef.current = pkey;
        flash({ kind: "warn", big: "2nd?", name: emp.name, sub: `Already had ${item.label}. Scan again to add an extra — ₹${rateFor(item, emp.rate_tier, concessionRate)}, charged.` });
        return;
      }
      pendingRef.current = null;
      await recordItems(emp, win, [key], isOverride);
    },
    [win, windows, nowMin, lookup, items, concessionRate, flash, recordItems]
  );

  // keep the wedge input focused for hardware scanners
  useEffect(() => {
    if (!chooser) inputRef.current?.focus();
  }, [chooser, result]);

  async function startCamera() {
    try {
      const mod = await import("html5-qrcode");
      const el = document.getElementById("qr-cam");
      if (!el) return;
      const scanner = new mod.Html5Qrcode("qr-cam");
      scannerRef.current = { stop: () => scanner.stop() };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 200 },
        (decoded: string) => {
          handleCard(decoded);
        },
        () => {}
      );
      setCam(true);
    } catch {
      flash({ kind: "bad", big: "✕", name: "Camera", sub: "Could not start camera — use the scanner or type the ID." });
    }
  }
  async function stopCamera() {
    try {
      await scannerRef.current?.stop();
    } catch {
      /* ignore */
    }
    setCam(false);
  }
  useEffect(() => () => void scannerRef.current?.stop().catch(() => {}), []);

  function overridePrompt() {
    const id = window.prompt("Supervisor override — enter card ID (no card):");
    if (!id) return;
    const pin = window.prompt("Supervisor PIN:");
    if (pin !== SUPERVISOR_PIN) {
      flash({ kind: "bad", big: "✕", name: "Override", sub: "Wrong PIN" });
      return;
    }
    handleCard(id, true);
  }

  if (loading) return <p className="lead">Loading…</p>;

  return (
    <>
      <div className="h">
        <div>
          <h1>Scan</h1>
          <div className="sub">
            {win
              ? `${win.name} · ${fmtTime(winStart(win))}–${fmtTime(winEnd(win))} · ${win.items.map((k) => itemByKey(items, k)?.label).join(" + ")}`
              : (() => {
                  const nx = nextWindow(windows, nowMin);
                  return nx ? `Counter closed · next: ${nx.name} at ${fmtTime(winStart(nx))}` : "Counter closed — no more meals today";
                })()}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{fmtTime(nowMin)}</div>
      </div>

      <div className="panel" style={{ maxWidth: 460 }}>
        <div id="qr-cam" style={{ width: "100%", borderRadius: 12, overflow: "hidden", marginBottom: cam ? 12 : 0 }} />
        <div className="row">
          {!cam ? (
            <button className="btn" onClick={startCamera}>Start camera</button>
          ) : (
            <button className="btn" onClick={stopCamera}>Stop camera</button>
          )}
        </div>

        <form
          style={{ marginTop: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            const v = inputRef.current?.value || "";
            if (inputRef.current) inputRef.current.value = "";
            handleCard(v);
          }}
        >
          <label className="field">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Scan or type card ID</span>
            <input ref={inputRef} className="inp mono" autoFocus placeholder="HT-014" autoComplete="off" disabled={busy} />
          </label>
        </form>

        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm" onClick={overridePrompt}>No card? Supervisor override</button>
        </div>
      </div>

      {result && (
        <div
          className="panel"
          style={{
            maxWidth: 460,
            background:
              result.kind === "ok" ? "var(--ok)" : result.kind === "warn" ? "var(--amber)" : "var(--bad)",
            color: "#fff",
            borderColor: "transparent",
          }}
        >
          <div style={{ fontFamily: "var(--display)", fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{result.big}</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{result.name}</div>
          <div style={{ opacity: 0.95, marginTop: 2 }}>{result.sub}</div>
        </div>
      )}

      {chooser && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
          onClick={() => setChooser(null)}
        >
          <div className="panel" style={{ maxWidth: 380, width: "100%", marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ textAlign: "center" }}>{chooser.emp.name}</h2>
            <p className="lead" style={{ textAlign: "center" }}>{chooser.win.name} — what did they take?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => {
                const [a, b] = chooser.win.items;
                const ia = itemByKey(items, a)!;
                const ib = itemByKey(items, b)!;
                const rA = rateFor(ia, chooser.emp.rate_tier, concessionRate);
                const rB = rateFor(ib, chooser.emp.rate_tier, concessionRate);
                const btn = (label: string, amt: number, chosen: ItemKey[], primary = false) => (
                  <button
                    className={"btn" + (primary ? " primary" : "")}
                    style={{ justifyContent: "space-between", fontSize: 16, padding: "15px 16px" }}
                    disabled={busy}
                    onClick={async () => {
                      const c = chooser;
                      setChooser(null);
                      await recordItems(c.emp, c.win, chosen, false);
                    }}
                  >
                    <span>{label}</span>
                    <span className="mono" style={{ opacity: 0.8 }}>₹{amt}</span>
                  </button>
                );
                return (
                  <>
                    {btn(`Only ${ia.label.replace(" (morning)", "").replace(" (evening)", "")}`, rA, [a])}
                    {btn(`Only ${ib.label.replace(" (morning)", "").replace(" (evening)", "")}`, rB, [b])}
                    {btn("Both", rA + rB, [a, b], true)}
                  </>
                );
              })()}
              <button className="btn sm" onClick={() => setChooser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
