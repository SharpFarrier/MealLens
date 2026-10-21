-- ============================================================================
-- MealLens migration — run this in the SHARED DispatchLens Supabase project
-- (hjjovblqvzpcpijtrmer) BEFORE deploying the app.
-- Safe to re-run: guarded with IF NOT EXISTS / IF EXISTS throughout.
-- It does NOT drop or rewrite any existing DispatchLens table; it only adds
-- the canteen tables and a single `can_canteen` column to dispatch_user_access.
-- ============================================================================

-- 1) Access flag on the existing DispatchLens access table ---------------------
alter table if exists public.dispatch_user_access
  add column if not exists can_canteen boolean not null default false;

-- 2) Shared employees table ----------------------------------------------------
-- Lives in the shared DB on purpose: DispatchLens and other Lens tools can read it.
create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  card_id     text unique not null,                 -- QR payload, e.g. 'HT-014'
  name        text not null,
  site        text default 'Kalyan',
  active      boolean not null default true,
  rate_tier   text not null default 'standard' check (rate_tier in ('standard','concession')),
  lunch_rate  integer,                              -- per-person override (future); null = use config
  dinner_rate integer,
  created_at  timestamptz not null default now()
);

-- 3) Canteen item catalogue + rates -------------------------------------------
create table if not exists public.canteen_items (
  key            text primary key,
  label          text not null,
  rate           integer not null,
  concessionable boolean not null default false,
  sort           integer not null default 0
);

-- 4) One row per item taken ----------------------------------------------------
create table if not exists public.canteen_scans (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  card_id     text not null,
  item_key    text not null references public.canteen_items(key),
  window_key  text not null,
  scanned_at  timestamptz not null default now(),
  meal_date   date not null,
  amount      integer not null,
  is_extra    boolean not null default false,
  is_override boolean not null default false,
  actor       text,
  device      text,
  note        text
);

create index if not exists canteen_scans_date_idx on public.canteen_scans (meal_date);
create index if not exists canteen_scans_emp_idx  on public.canteen_scans (employee_id, meal_date);

-- one BASE serving per item per person per day; extras are exempt and may repeat
create unique index if not exists canteen_scans_one_base_per_day
  on public.canteen_scans (employee_id, item_key, meal_date)
  where is_extra = false;

-- 5) Config: concession rate + window times -----------------------------------
create table if not exists public.canteen_config (
  id              integer primary key default 1,
  concession_rate integer not null default 25,
  windows         jsonb not null,
  updated_at      timestamptz not null default now(),
  constraint canteen_config_singleton check (id = 1)
);

-- 6) Seed catalogue, config (only if empty) -----------------------------------
insert into public.canteen_items (key, label, rate, concessionable, sort) values
  ('breakfast', 'Breakfast',      20, false, 1),
  ('tea_am',    'Tea (morning)',   8, false, 2),
  ('lunch',     'Lunch',          50, true,  3),
  ('tea_pm',    'Tea (evening)',   8, false, 4),
  ('snacks',    'Snacks',         20, false, 5),
  ('dinner',    'Dinner',         50, true,  6)
on conflict (key) do nothing;

insert into public.canteen_config (id, concession_rate, windows) values
  (1, 25, '[
    {"key":"morning","name":"Morning","items":["breakfast","tea_am"],"start":[8,15],"end":[8,45]},
    {"key":"lunch","name":"Lunch","items":["lunch"],"start":[13,0],"end":[14,0]},
    {"key":"evening","name":"Evening","items":["tea_pm","snacks"],"start":[16,15],"end":[16,30]},
    {"key":"dinner","name":"Dinner","items":["dinner"],"start":[20,0],"end":[21,0]}
  ]'::jsonb)
on conflict (id) do nothing;

-- 7) Row Level Security --------------------------------------------------------
-- Every canteen table is readable/writable only by a signed-in user who has
-- can_canteen = true in dispatch_user_access.
alter table public.employees      enable row level security;
alter table public.canteen_items  enable row level security;
alter table public.canteen_scans  enable row level security;
alter table public.canteen_config enable row level security;

create or replace function public.has_canteen_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dispatch_user_access
    where user_id = auth.uid() and can_canteen = true
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['employees','canteen_items','canteen_scans','canteen_config'] loop
    execute format('drop policy if exists canteen_rw on public.%I', t);
    execute format(
      'create policy canteen_rw on public.%I for all to authenticated using (public.has_canteen_access()) with check (public.has_canteen_access())',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- After running: grant yourself access with
--   update public.dispatch_user_access set can_canteen = true where user_id = '<your-auth-uid>';
-- (or insert a row if you don't have one yet). Then sign in to MealLens.
-- ============================================================================
