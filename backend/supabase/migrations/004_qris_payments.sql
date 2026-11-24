-- Pay before book (QRIS): a booking holds its slot for 15 minutes while it waits for payment.
-- Safe to run on a live database: the code before this migration keeps working.

begin;

-- New booking statuses: awaiting_payment (slot held, QR shown) and expired (not paid in time).
alter table public.bookings drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in (
    'pending', 'awaiting_payment', 'confirmed', 'completed', 'no_show', 'cancelled', 'expired'
  ));

-- Payment facts per booking. All null when the shop runs without online payment (PAYMENT_MODE=off).
alter table public.bookings add column if not exists payment_status text
  check (payment_status in ('waiting', 'paid', 'expired', 'paid_late'));
alter table public.bookings add column if not exists payment_amount integer;
alter table public.bookings add column if not exists payment_mode text;          -- demo | midtrans
alter table public.bookings add column if not exists payment_order_id text;      -- Midtrans order_id
alter table public.bookings add column if not exists payment_qr_url text;
alter table public.bookings add column if not exists payment_expires_at timestamptz;
alter table public.bookings add column if not exists paid_at timestamptz;

create unique index if not exists idx_bookings_payment_order_id
  on public.bookings (payment_order_id)
  where payment_order_id is not null;

-- A held slot (awaiting_payment) is taken: the database itself refuses a second booking
-- for the same barber, date and time, so two customers can never both get it.
drop index if exists idx_bookings_one_active_per_barber_slot;

create unique index idx_bookings_one_active_per_barber_slot
  on public.bookings (barber_id, booking_date, booking_time)
  where status in ('pending', 'awaiting_payment', 'confirmed');

create index if not exists idx_bookings_hold_expiry
  on public.bookings (payment_expires_at)
  where status = 'awaiting_payment';

commit;
