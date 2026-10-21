// Pure meal logic — no DB, no React. Everything here is unit-testable in node.
// This is the heart of MealLens: which window is open, which items it offers,
// and what each scan costs (including the lunch/dinner concession and extras).

export type ItemKey = "breakfast" | "tea_am" | "lunch" | "tea_pm" | "snacks" | "dinner";
export type Tier = "standard" | "concession";

export interface Item {
  key: ItemKey;
  label: string;
  rate: number; // standard rate, in rupees
  concessionable: boolean; // does the concession rate apply to this item?
  sort: number;
}

export interface MealWindow {
  key: string;
  name: string;
  items: ItemKey[]; // one item = straight-through; two = three-button chooser
  start: [number, number]; // [hour, minute] 24h
  end: [number, number];
}

// Defaults mirror the confirmed canteen setup. These are seeded into
// canteen_items / canteen_config so they can be edited in Settings without a deploy.
export const DEFAULT_ITEMS: Item[] = [
  { key: "breakfast", label: "Breakfast", rate: 20, concessionable: false, sort: 1 },
  { key: "tea_am", label: "Tea (morning)", rate: 8, concessionable: false, sort: 2 },
  { key: "lunch", label: "Lunch", rate: 50, concessionable: true, sort: 3 },
  { key: "tea_pm", label: "Tea (evening)", rate: 8, concessionable: false, sort: 4 },
  { key: "snacks", label: "Snacks", rate: 20, concessionable: false, sort: 5 },
  { key: "dinner", label: "Dinner", rate: 50, concessionable: true, sort: 6 },
];

export const DEFAULT_CONCESSION_RATE = 25;

export const DEFAULT_WINDOWS: MealWindow[] = [
  { key: "morning", name: "Morning", items: ["breakfast", "tea_am"], start: [8, 15], end: [8, 45] },
  { key: "lunch", name: "Lunch", items: ["lunch"], start: [13, 0], end: [14, 0] },
  { key: "evening", name: "Evening", items: ["tea_pm", "snacks"], start: [16, 15], end: [16, 30] },
  { key: "dinner", name: "Dinner", items: ["dinner"], start: [20, 0], end: [21, 0] },
];

export function minutesOf(h: number, m: number): number {
  return h * 60 + m;
}

export function winStart(w: MealWindow): number {
  return minutesOf(w.start[0], w.start[1]);
}
export function winEnd(w: MealWindow): number {
  return minutesOf(w.end[0], w.end[1]);
}

/** The window open at `nowMinutes` (minutes since midnight), or null if the counter is closed. */
export function activeWindow(windows: MealWindow[], nowMinutes: number): MealWindow | null {
  for (const w of windows) {
    if (nowMinutes >= winStart(w) && nowMinutes < winEnd(w)) return w;
  }
  return null;
}

/** The next window to open after `nowMinutes`, or null if none left today. */
export function nextWindow(windows: MealWindow[], nowMinutes: number): MealWindow | null {
  const upcoming = windows
    .filter((w) => nowMinutes < winStart(w))
    .sort((a, b) => winStart(a) - winStart(b));
  return upcoming[0] ?? null;
}

/** Rate a given person-tier pays for an item. Concession only ever touches concessionable items. */
export function rateFor(item: Item, tier: Tier, concessionRate: number): number {
  if (tier === "concession" && item.concessionable) return concessionRate;
  return item.rate;
}

export function itemByKey(items: Item[], key: ItemKey): Item | undefined {
  return items.find((i) => i.key === key);
}

/** hh:mm am/pm for display. */
export function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = h % 12 || 12;
  const ap = h < 12 ? "am" : "pm";
  return `${hh}:${m < 10 ? "0" : ""}${m} ${ap}`;
}

export interface ScanOutcome {
  itemKey: ItemKey;
  amount: number;
  isExtra: boolean;
}

/**
 * Resolve what a set of chosen items costs for a person, given which items they
 * already took today (so repeats become charged extras rather than being blocked).
 */
export function resolveScan(
  chosen: ItemKey[],
  alreadyTaken: Set<ItemKey>,
  items: Item[],
  tier: Tier,
  concessionRate: number
): ScanOutcome[] {
  const out: ScanOutcome[] = [];
  for (const key of chosen) {
    const item = itemByKey(items, key);
    if (!item) continue;
    out.push({
      itemKey: key,
      amount: rateFor(item, tier, concessionRate),
      isExtra: alreadyTaken.has(key),
    });
  }
  return out;
}

export function totalCharge(outcomes: ScanOutcome[]): number {
  return outcomes.reduce((a, o) => a + o.amount, 0);
}
