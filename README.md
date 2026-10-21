# MealLens

Canteen meal counting + billing for the Honey Touch / Sabi Wabi Innovations Kalyan warehouse.
Standalone Next.js app with its own repo and URL — it shares **only** the DispatchLens
Supabase database (`hjjovblqvzpcpijtrmer`), so employee data lives in one place both apps can read.

## What it does

- **Scan** — the counter screen. Reads a worker's card QR (phone camera *or* a USB/Bluetooth
  scanner typing into the field) and infers the meal window from the clock. Morning (Breakfast +
  Tea) and Evening (Tea + Snacks) show three buttons — Only X / Only Y / Both — so each item is
  counted and charged on its own. Lunch and Dinner go straight through. A repeat of the same item
  prompts, then records a **charged extra** (never blocked). Supervisor PIN override for no-card cases.
- **Report** — today's per-item counts and amounts, and a month view that reconciles scanned counts
  against the caterer's claimed counts, with CSV export.
- **People** — add / remove employees, set rate tier, and **print the ID card** (QR generated from
  the card ID; cards carry no name, so staff changes never need a reprint).
- **Settings** — per-item rates, the concession rate (lunch & dinner), and meal-window times set
  with iOS drum-wheel pickers.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Supabase (`@supabase/ssr`) · qrcode · html5-qrcode.
Auth reuses the DispatchLens Supabase accounts; access is gated on `dispatch_user_access.can_canteen`.

## Setup

1. **Run the migration first** — open `supabase/migration.sql` in the Supabase SQL editor for project
   `hjjovblqvzpcpijtrmer` and run it. It adds `can_canteen` to `dispatch_user_access` and creates
   `employees`, `canteen_items`, `canteen_scans`, `canteen_config` (with RLS + seed data). It does
   not touch any existing DispatchLens table.
2. **Give yourself access:**
   ```sql
   update public.dispatch_user_access set can_canteen = true where user_id = '<your-auth-uid>';
   ```
3. **Env:** copy `.env.local.example` to `.env.local` and fill in the Supabase URL + anon key (same
   project as DispatchLens). Optionally set `NEXT_PUBLIC_SUPERVISOR_PIN` (defaults to `2468`).
4. **Install & run:**
   ```bash
   npm install
   npm run dev
   ```

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run typecheck` — `tsc --noEmit`
- `npm run test:logic` — esbuild-bundles and runs the pure meal-logic tests (`scripts/test-logic.ts`)

## Notes / next steps

- The counter camera needs HTTPS (Vercel provides it) and a one-time camera permission on that phone.
- `NEXT_PUBLIC_SUPERVISOR_PIN` is a client-side soft gate for the MVP; move it server-side if overrides
  need to be tamper-proof.
- Per-person concession overrides already have columns (`employees.lunch_rate` / `dinner_rate`); the
  billing currently uses the single config rate and can be switched to read these later.
