"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCanteenConfig, localDate } from "@/lib/useConfig";
import type { CanteenScanRow } from "@/lib/types";
import type { ItemKey } from "@/lib/meals";

function monthBounds(d = new Date()) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { first: localDate(first), last: localDate(last), label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
}

export default function ReportPage() {
  const { items, concessionRate } = useCanteenConfig();
  const [scans, setScans] = useState<CanteenScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "month">("today");
  const [claims, setClaims] = useState<Record<string, number>>({});
  const mb = useMemo(() => monthBounds(), []);
  const today = localDate();

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = createClient();
      const { data } = await s
        .from("canteen_scans")
        .select("*")
        .gte("meal_date", mb.first)
        .lte("meal_date", mb.last)
        .order("scanned_at", { ascending: false });
      if (!alive) return;
      setScans((data as CanteenScanRow[]) || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [mb.first, mb.last]);

  const agg = useMemo(() => {
    const todayRows = scans.filter((r) => r.meal_date === today);
    const per = (rows: CanteenScanRow[], key: ItemKey) => {
      const rs = rows.filter((r) => r.item_key === key);
      return { count: rs.length, extras: rs.filter((r) => r.is_extra).length, amount: rs.reduce((a, r) => a + r.amount, 0) };
    };
    return { todayRows, per };
  }, [scans, today]);

  function exportCsv() {
    const header = ["meal_date", "scanned_at", "card_id", "item_key", "window_key", "amount", "is_extra", "is_override", "actor"];
    const lines = [header.join(",")];
    for (const r of scans) {
      lines.push(
        [r.meal_date, r.scanned_at, r.card_id, r.item_key, r.window_key, r.amount, r.is_extra, r.is_override, r.actor ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meallens-${mb.first}-to-${mb.last}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="lead">Loading…</p>;

  return (
    <>
      <div className="h">
        <div>
          <h1>Report</h1>
          <div className="sub">Kalyan · counts come straight from the counter scans</div>
        </div>
        <div className="row">
          <div className="seg">
            <button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>Today</button>
            <button className={tab === "month" ? "on" : ""} onClick={() => setTab("month")}>This month</button>
          </div>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {tab === "today" && (
        <div className="panel">
          <h2>Today — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</h2>
          <p className="lead">Each item counted on its own. Concession people are billed at the lower lunch/dinner rate automatically.</p>
          <div className="tiles">
            {items.map((it) => {
              const a = agg.per(agg.todayRows, it.key);
              return (
                <div className="tile" key={it.key}>
                  <div className="k">{it.label}</div>
                  <div className="v">{a.count}</div>
                  <div className={"s" + (a.extras ? " ov" : "")}>{a.extras ? `incl. ${a.extras} extra · ₹${a.amount}` : `₹${a.amount}`}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "month" && (
        <div className="panel">
          <h2>{mb.label} vs caterer bill</h2>
          <p className="lead">Type the caterer&apos;s claimed count per item to see the gap. Scanned counts and amounts are from MealLens.</p>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="n">Rate</th>
                  <th className="n">Scanned</th>
                  <th className="n">Amount</th>
                  <th className="n">Caterer claims</th>
                  <th className="n">Diff</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const a = agg.per(scans, it.key);
                  const claim = claims[it.key];
                  const diff = claim === undefined || Number.isNaN(claim) ? null : a.count - claim;
                  return (
                    <tr key={it.key}>
                      <td>{it.label}</td>
                      <td className="n mono">₹{it.rate}{it.concessionable ? ` / ₹${concessionRate}` : ""}</td>
                      <td className="n mono">{a.count}</td>
                      <td className="n mono">₹{a.amount.toLocaleString("en-IN")}</td>
                      <td className="n">
                        <input
                          className="inp mono"
                          style={{ width: 90, textAlign: "right", padding: "5px 8px" }}
                          inputMode="numeric"
                          placeholder="—"
                          onChange={(e) => setClaims((c) => ({ ...c, [it.key]: parseInt(e.target.value, 10) }))}
                        />
                      </td>
                      <td className={"n mono diff" + (diff === null ? "" : diff < 0 ? " neg" : " pos")}>
                        {diff === null ? "—" : (diff > 0 ? "+" : "") + diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">A negative diff means the caterer billed more plates than we scanned. Export the CSV for the full line-by-line log.</p>
        </div>
      )}
    </>
  );
}
