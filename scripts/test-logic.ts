// Logic tests run in node via esbuild (npm run test:logic).
// Exercises window inference, concession pricing, and extras against sample rows.
import {
  DEFAULT_ITEMS,
  DEFAULT_WINDOWS,
  DEFAULT_CONCESSION_RATE,
  activeWindow,
  nextWindow,
  minutesOf,
  rateFor,
  itemByKey,
  resolveScan,
  totalCharge,
  type ItemKey,
} from "../lib/meals";

let passed = 0;
let failed = 0;
function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL ${label}\n  got:  ${g}\n  want: ${w}`);
  }
}

// --- window inference ---
eq("8:20 is morning", activeWindow(DEFAULT_WINDOWS, minutesOf(8, 20))?.key, "morning");
eq("8:45 edge is closed (end exclusive)", activeWindow(DEFAULT_WINDOWS, minutesOf(8, 45)), null);
eq("13:30 is lunch", activeWindow(DEFAULT_WINDOWS, minutesOf(13, 30))?.key, "lunch");
eq("16:20 is evening", activeWindow(DEFAULT_WINDOWS, minutesOf(16, 20))?.key, "evening");
eq("20:30 is dinner", activeWindow(DEFAULT_WINDOWS, minutesOf(20, 30))?.key, "dinner");
eq("11:00 is a gap", activeWindow(DEFAULT_WINDOWS, minutesOf(11, 0)), null);
eq("next after 11:00 is lunch", nextWindow(DEFAULT_WINDOWS, minutesOf(11, 0))?.key, "lunch");
eq("no next after 21:30", nextWindow(DEFAULT_WINDOWS, minutesOf(21, 30)), null);

// morning offers two items -> three-button chooser; lunch offers one -> straight through
eq("morning items", activeWindow(DEFAULT_WINDOWS, minutesOf(8, 20))?.items, ["breakfast", "tea_am"]);
eq("lunch items", activeWindow(DEFAULT_WINDOWS, minutesOf(13, 30))?.items, ["lunch"]);

// --- concession pricing: only lunch & dinner, only for concession tier ---
const lunch = itemByKey(DEFAULT_ITEMS, "lunch")!;
const breakfast = itemByKey(DEFAULT_ITEMS, "breakfast")!;
const dinner = itemByKey(DEFAULT_ITEMS, "dinner")!;
eq("standard lunch = 50", rateFor(lunch, "standard", DEFAULT_CONCESSION_RATE), 50);
eq("concession lunch = 25", rateFor(lunch, "concession", DEFAULT_CONCESSION_RATE), 25);
eq("concession dinner = 25", rateFor(dinner, "concession", DEFAULT_CONCESSION_RATE), 25);
eq("concession does NOT touch breakfast", rateFor(breakfast, "concession", DEFAULT_CONCESSION_RATE), 20);
eq("editable concession rate (30)", rateFor(lunch, "concession", 30), 30);

// --- resolveScan: independence + extras ---
// someone takes only tea in the morning -> charged for tea alone
const onlyTea = resolveScan(["tea_am"], new Set<ItemKey>(), DEFAULT_ITEMS, "standard", DEFAULT_CONCESSION_RATE);
eq("only tea charges tea only", totalCharge(onlyTea), 8);

// both in the morning, nothing taken yet
const both = resolveScan(["breakfast", "tea_am"], new Set<ItemKey>(), DEFAULT_ITEMS, "standard", DEFAULT_CONCESSION_RATE);
eq("breakfast + tea = 28", totalCharge(both), 28);
eq("neither flagged extra", both.map((o) => o.isExtra), [false, false]);

// second tea when tea already taken -> extra, still charged
const secondTea = resolveScan(["tea_am"], new Set<ItemKey>(["tea_am"]), DEFAULT_ITEMS, "standard", DEFAULT_CONCESSION_RATE);
eq("second tea still 8", totalCharge(secondTea), 8);
eq("second tea flagged extra", secondTea[0].isExtra, true);

// concession person at lunch
const concLunch = resolveScan(["lunch"], new Set<ItemKey>(), DEFAULT_ITEMS, "concession", DEFAULT_CONCESSION_RATE);
eq("concession lunch charges 25", totalCharge(concLunch), 25);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`All ${passed} logic tests passed.`);
}
