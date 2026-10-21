"use client";

import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import {
  DEFAULT_ITEMS,
  DEFAULT_WINDOWS,
  DEFAULT_CONCESSION_RATE,
  type Item,
  type MealWindow,
} from "./meals";

export interface CanteenConfig {
  items: Item[];
  windows: MealWindow[];
  concessionRate: number;
  loading: boolean;
}

export function useCanteenConfig(): CanteenConfig {
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [windows, setWindows] = useState<MealWindow[]>(DEFAULT_WINDOWS);
  const [concessionRate, setConcessionRate] = useState(DEFAULT_CONCESSION_RATE);
  const [loading, setLoading] = useState(true);

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
        setConcessionRate(row.concession_rate);
        if (row.windows) setWindows(row.windows);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { items, windows, concessionRate, loading };
}

/** Local YYYY-MM-DD (device timezone) — matches canteen_scans.meal_date. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
