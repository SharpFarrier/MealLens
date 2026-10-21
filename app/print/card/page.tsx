"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import IdCard from "@/components/IdCard";
import type { EmployeeRow } from "@/lib/types";

function PrintCards() {
  const params = useSearchParams();
  const ids = (params.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const [people, setPeople] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const { data } = await createClient().from("employees").select("*").in("card_id", ids);
      if (!alive) return;
      // keep the order of the ids param
      const byId = new Map((data as EmployeeRow[] | null)?.map((p) => [p.card_id, p]) || []);
      setPeople(ids.map((id) => byId.get(id)).filter((p): p is EmployeeRow => Boolean(p)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!loading && people.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, people.length]);

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (people.length === 0) return <p style={{ padding: 24 }}>No cards to print.</p>;

  return (
    <div className="printwrap">
      <div className="toolbar">
        <button className="btn primary" onClick={() => window.print()}>Print</button>
        <span className="note" style={{ margin: 0 }}>{people.length} card(s) · CR80 (54 × 85.6 mm)</span>
      </div>
      <div className="grid">
        {people.map((p) => (
          <div className="cardslot" key={p.id}>
            <IdCard emp={p} qrSize={150} width="54mm" />
          </div>
        ))}
      </div>
      <style>{`
        .printwrap{padding:24px;background:var(--bg)}
        .toolbar{display:flex;gap:12px;align-items:center;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,54mm);gap:10mm;justify-content:center}
        @media print{
          .toolbar{display:none}
          .printwrap{padding:0;background:#fff}
          .grid{gap:0}
          .cardslot{break-inside:avoid;page-break-inside:avoid}
        }
      `}</style>
    </div>
  );
}

export default function PrintCardPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <PrintCards />
    </Suspense>
  );
}
