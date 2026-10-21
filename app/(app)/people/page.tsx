"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import IdCard from "@/components/IdCard";
import type { EmployeeRow } from "@/lib/types";
import type { Tier } from "@/lib/meals";

export default function PeoplePage() {
  const [people, setPeople] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", card_id: "", site: "Kalyan", rate_tier: "standard" as Tier });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const s = createClient();
    const { data } = await s.from("employees").select("*").order("card_id");
    const rows = (data as EmployeeRow[]) || [];
    setPeople(rows);
    setSel((cur) => cur ?? rows[0]?.id ?? null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(() => people.find((p) => p.id === sel) || null, [people, sel]);

  const nextCardId = useMemo(() => {
    let max = 0;
    for (const p of people) {
      const m = /^HT-(\d+)$/.exec(p.card_id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return "HT-" + String(max + 1).padStart(3, "0");
  }, [people]);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const s = createClient();
    const card_id = (form.card_id || nextCardId).trim();
    const { data, error } = await s
      .from("employees")
      .insert({ name: form.name.trim(), card_id, site: form.site.trim() || "Kalyan", rate_tier: form.rate_tier, active: true })
      .select("*")
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setAdding(false);
    setForm({ name: "", card_id: "", site: "Kalyan", rate_tier: "standard" });
    await load();
    if (data) setSel((data as EmployeeRow).id);
  }

  async function remove(p: EmployeeRow) {
    if (!window.confirm(`Remove ${p.name} (${p.card_id})? Their scan history is kept.`)) return;
    await createClient().from("employees").delete().eq("id", p.id);
    if (sel === p.id) setSel(null);
    await load();
  }

  async function setTier(p: EmployeeRow, tier: Tier) {
    await createClient().from("employees").update({ rate_tier: tier }).eq("id", p.id);
    await load();
  }
  async function toggleActive(p: EmployeeRow) {
    await createClient().from("employees").update({ active: !p.active }).eq("id", p.id);
    await load();
  }

  if (loading) return <p className="lead">Loading…</p>;

  return (
    <>
      <div className="h">
        <div>
          <h1>People</h1>
          <div className="sub">{people.length} employees · the card carries only the ID, so staff changes never need a reprint</div>
        </div>
        <button className="btn primary" onClick={() => { setAdding((v) => !v); setForm((f) => ({ ...f, card_id: nextCardId })); }}>
          {adding ? "Close" : "Add employee"}
        </button>
      </div>

      {adding && (
        <div className="panel">
          <h2>Add employee</h2>
          <form onSubmit={addEmployee} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" }}>
            <label className="field"><span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Name</span>
              <input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field"><span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Card ID</span>
              <input className="inp mono" value={form.card_id} placeholder={nextCardId} onChange={(e) => setForm({ ...form, card_id: e.target.value })} />
            </label>
            <label className="field"><span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Site</span>
              <input className="inp" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
            </label>
            <label className="field"><span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Rate tier</span>
              <select className="inp" value={form.rate_tier} onChange={(e) => setForm({ ...form, rate_tier: e.target.value as Tier })}>
                <option value="standard">Standard</option>
                <option value="concession">Concession</option>
              </select>
            </label>
            <button className="btn primary" style={{ height: 38 }}>Save</button>
          </form>
          {err && <p style={{ color: "var(--bad)", fontSize: 13 }}>{err}</p>}
        </div>
      )}

      <div className="split">
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="tw" style={{ border: 0 }}>
            <table>
              <thead>
                <tr><th>Card ID</th><th>Name</th><th>Site</th><th>Tier</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer", background: p.id === sel ? "var(--line2)" : undefined }} onClick={() => setSel(p.id)}>
                    <td className="mono">{p.card_id}</td>
                    <td>{p.name}</td>
                    <td>{p.site}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        value={p.rate_tier}
                        onChange={(e) => setTier(p, e.target.value as Tier)}
                        style={{ font: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 6px", background: "var(--bg)", color: "var(--fg)" }}
                      >
                        <option value="standard">Standard</option>
                        <option value="concession">Concession</option>
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className={"pill " + (p.active ? "on" : "off")} style={{ border: 0, cursor: "pointer" }} onClick={() => toggleActive(p)}>
                        {p.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="rowact">
                        <Link className="iconbtn" title="Print card" href={`/print/card?ids=${encodeURIComponent(p.card_id)}`} target="_blank">🖨</Link>
                        <button className="iconbtn" title="Remove" onClick={() => remove(p)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No employees yet — add your first above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>ID card{selected ? ` · ${selected.card_id}` : ""}</h2>
          {selected ? (
            <>
              <p className="lead">QR encodes the card ID. {selected.name}</p>
              <IdCard emp={selected} />
              <div className="row" style={{ marginTop: 14 }}>
                <Link className="btn primary sm" href={`/print/card?ids=${encodeURIComponent(selected.card_id)}`} target="_blank">Print this card</Link>
                <Link className="btn sm" href={`/print/card?ids=${people.map((p) => encodeURIComponent(p.card_id)).join(",")}`} target="_blank">Batch print all</Link>
              </div>
              <p className="note">Opens a print-ready page at CR80 size; print to the card printer or save as PDF.</p>
            </>
          ) : (
            <p className="lead">Select an employee to preview and print their card.</p>
          )}
        </div>
      </div>
    </>
  );
}
