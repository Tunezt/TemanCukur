-- Run this in Supabase SQL Editor (or via migration tooling).

-- Bookings: one active row per date+time enforced by partial unique index.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  whatsapp text not null,
  service text not null,
  booking_date date not null,
  booking_time text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_bookings_one_active_per_slot
  on public.bookings (booking_date, booking_time)
  where status = 'confirmed';

create index if not exists idx_bookings_date on public.bookings (booking_date);
create index if not exists idx_bookings_status on public.bookings (status);

-- Blocks: block_time null = entire day blocked; otherwise that single slot.
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  block_time text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_blocks_date on public.blocks (block_date);

-- RLS: backend uses service_role and bypasses RLS.
alter table public.bookings enable row level security;
alter table public.blocks enable row level security;

drop policy if exists "deny anon bookings" on public.bookings;
drop policy if exists "deny anon blocks" on public.blocks;

-- Deny direct anon/authenticated access via PostgREST (service_role still bypasses).
create policy "deny anon bookings"
  on public.bookings for all
  using (false);

create policy "deny anon blocks"
  on public.blocks for all
  using (false);
