-- Multi-barber: barbers table, per-barber booking slots, status + price snapshot.

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default '',
  photo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists idx_barbers_active_sort
  on public.barbers (is_active, sort_order);

-- Placeholder barbers (stable ids for local/dev seed)
insert into public.barbers (id, name, specialty, photo_url, is_active, sort_order)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    'Andi Pratama',
    'Fade & taper',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
    true,
    1
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'Budi Santoso',
    'Texture & crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80',
    true,
    2
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'Cahyo Wijaya',
    'Classic & beard',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80',
    true,
    3
  )
on conflict (id) do nothing;

alter table public.bookings
  add column if not exists barber_id uuid references public.barbers (id);

alter table public.bookings
  add column if not exists service_price integer;

-- Expand status enum; default pending for future inserts
alter table public.bookings drop constraint if exists bookings_status_check;

alter table public.bookings
  alter column status set default 'pending';

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'no_show', 'cancelled'));

-- Per-barber uniqueness: two barbers may share a slot; one barber cannot
drop index if exists idx_bookings_one_active_per_slot;

create unique index if not exists idx_bookings_one_active_per_barber_slot
  on public.bookings (barber_id, booking_date, booking_time)
  where status in ('pending', 'confirmed');

create index if not exists idx_bookings_barber_id on public.bookings (barber_id);

alter table public.barbers enable row level security;

drop policy if exists "deny anon barbers" on public.barbers;

create policy "deny anon barbers"
  on public.barbers for all
  using (false);
