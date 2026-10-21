// Row shapes for the MealLens tables in the shared Supabase project.
import type { ItemKey, Tier } from "./meals";

export interface EmployeeRow {
  id: string;
  card_id: string; // e.g. "HT-014" — the QR payload
  name: string;
  site: string | null;
  active: boolean;
  rate_tier: Tier;
  lunch_rate: number | null; // per-person override (future); null = use config
  dinner_rate: number | null;
  created_at: string;
}

export interface CanteenItemRow {
  key: ItemKey;
  label: string;
  rate: number;
  concessionable: boolean;
  sort: number;
}

export interface CanteenScanRow {
  id: string;
  employee_id: string;
  card_id: string;
  item_key: ItemKey;
  window_key: string;
  scanned_at: string; // ISO timestamp
  meal_date: string; // YYYY-MM-DD (local), used for "one per day" + reporting
  amount: number;
  is_extra: boolean;
  is_override: boolean;
  actor: string | null; // staff/supervisor who recorded it
  device: string | null;
  note: string | null;
}

export interface CanteenConfigRow {
  id: number;
  concession_rate: number;
  windows: WindowConfig[]; // jsonb
  updated_at: string;
}

export interface WindowConfig {
  key: string;
  name: string;
  items: ItemKey[];
  start: [number, number];
  end: [number, number];
}

export interface AccessRow {
  user_id: string;
  can_canteen: boolean;
}
