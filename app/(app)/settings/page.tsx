"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Wheel from "@/components/Wheel";
import {
  DEFAULT_ITEMS,
  DEFAULT_WINDOWS,
  DEFAULT_CONCESSION_RATE,
  type Item,
  type MealWindow,
} from "@/lib/meals";

export default function SettingsPage() {
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [windows, setWindows] = useState<MealWindow[]>(DEFAULT_WINDOWS);
  const [conc, setConc] = useState(DEFAULT_CONCESSION_RATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = createClient();
      const [it, cfg] = await Promise.all([
        s.from("canteen_items").select("*").order("sort"),
        s.from("canteen_config").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (!alive) return;
      if (it.data && it.data.length) setItems(it.data as Item[]);
      if (cfg.data) {
        const row = cfg.data as { concession_rate: number; windows: MealWindow[] };
        setConc(row.concession_rate);
        if (row.windows) setWindows(row.windows);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function setRate(key: string, v: string) {
    const n = parseInt(v, 10);
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, rate: Number.isNaN(n) ? 0 : n } : i)));
  }
  function setWinTime(idx: number, edge: "start" | "end", val: [number, number]) {
    setWindows((arr) => arr.map((w, i) => (i === idx ? { ...w, [edge]: val } : w)));
  }

  async function save() {
    setSaving(true);
    setFlash(null);
    const s = createClient();
    for (const it of items) {
      await s.from("canteen_items").update({ rate: it.rate }).eq("key", it.key);
    }
    const { error } = await s
      .from("canteen_config")
      .upsert({ id: 1, concession_rate: conc, windows, updated_at: new Date().toISOString() });
    setSaving(false);
    setFlash(error ? error.message : "Saved to canteen_config");
    setTimeout(() => setFlash(null), 2200);
  }

  if (loading) return <p className="lead">Loading…</p>;

  return (
    <>
      <div className="h">
        <div>
          <h1>Settings</h1>
          <div className="sub">Rates, windows and the concession rate — stored in canteen_config / canteen_items</div>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="panel">
          <h2>Item rates</h2>
          <p className="lead">Per plate. Lunch &amp; dinner also take the concession rate below.</p>
          {items.map((it) => (
            <div key={it.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line2)" }}>
              <div className="row" style={{ gap: 7 }}>
                <span>{it.label}</span>
                {it.concessionable && <span className="pill conc">has concession</span>}
              </div>
              <div className="row" style={{ gap: 4 }}>
                ₹
                <input
                  className="inp mono"
                  style={{ width: 80, textAlign: "right", padding: "7px 9px" }}
                  inputMode="numeric"
                  value={it.rate}
                  onChange={(e) => setRate(it.key, e.target.value)}
                />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "2px solid var(--line)", marginTop: 6, paddingTop: 12 }}>
            <div className="row" style={{ gap: 7 }}>
              <b>Concession rate</b>
              <span className="pill conc">lunch &amp; dinner</span>
            </div>
            <div className="row" style={{ gap: 4 }}>
              ₹
              <input
                className="inp mono"
                style={{ width: 80, textAlign: "right", padding: "7px 9px" }}
                inputMode="numeric"
                value={conc}
                onChange={(e) => setConc(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))}
              />
            </div>
          </div>
          <p className="note">One rate for all concession people now; a per-person override (employees.lunch_rate / dinner_rate) can be wired in later.</p>
        </div>

        <div className="panel">
          <h2>Meal windows</h2>
          <p className="lead">The counter reads the active window from these times. Drum-wheel pickers — no typing.</p>
          {windows.map((w, i) => (
            <div key={w.key} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ minWidth: 150, fontWeight: 600 }}>
                {w.name}
                <small style={{ display: "block", color: "var(--muted)", fontWeight: 400, fontSize: 11 }}>
                  {w.items.join(" + ")}
                </small>
              </div>
              <div className="wheels">
                <Wheel value={w.start} onChange={(v) => setWinTime(i, "start", v)} />
                <span className="wheelsep">to</span>
                <Wheel value={w.end} onChange={(v) => setWinTime(i, "end", v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {flash && <div className="flash">{flash}</div>}
    </>
  );
}
