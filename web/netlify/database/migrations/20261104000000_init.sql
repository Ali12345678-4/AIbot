-- K444AXN Driving School: initial schema.
-- Works on any PostgreSQL 14+ (including Supabase).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- Single-row business + booking settings, editable from the admin dashboard.
create table if not exists settings (
  id                        int primary key default 1 check (id = 1),
  business_name             text not null default 'K444AXN Driving School',
  instructor_name           text,
  instructor_bio            text,
  instructor_qualifications text,
  teaching_approach         text,
  instructor_photo_url      text,
  years_experience          int,
  phone                     text,
  email                     text,
  notification_email        text,
  address_line              text,
  locality                  text,
  postcode                  text,
  service_areas             text,
  instagram_url             text,
  facebook_url              text,
  tiktok_url                text,
  timezone                  text not null default 'Europe/London',
  currency                  text not null default 'GBP',
  slot_interval_minutes     int  not null default 30 check (slot_interval_minutes between 5 and 240),
  buffer_minutes            int  not null default 0  check (buffer_minutes between 0 and 240),
  min_notice_hours          int  not null default 24 check (min_notice_hours between 0 and 720),
  max_advance_days          int  not null default 60 check (max_advance_days between 1 and 365),
  cancellation_notice_hours int  not null default 48 check (cancellation_notice_hours between 0 and 720),
  require_approval          boolean not null default true,
  payment_mode              text not null default 'pay_at_lesson'
                            check (payment_mode in ('pay_at_lesson','deposit','full')),
  deposit_pence             int  not null default 0 check (deposit_pence >= 0),
  updated_at                timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  password_changed_at timestamptz
);

create table if not exists lesson_types (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  description      text not null default '',
  duration_minutes int  not null check (duration_minutes between 15 and 600),
  price_pence      int  not null check (price_pence >= 0),
  active           boolean not null default true,
  featured         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Recurring weekly working hours (local wall-clock time in settings.timezone).
create table if not exists weekly_hours (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);

-- One-off changes: 'block' = unavailable (holiday, appointment), 'open' = extra availability.
create table if not exists schedule_exceptions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('block','open')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists schedule_exceptions_range_idx on schedule_exceptions using gist (tstzrange(starts_at, ends_at));

create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  email          text not null,
  phone          text not null,
  experience     text,
  internal_notes text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists students_email_key on students (lower(email));

create table if not exists bookings (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  student_id        uuid not null references students(id) on delete restrict,
  lesson_type_id    uuid references lesson_types(id) on delete set null,
  lesson_name       text not null,
  duration_minutes  int  not null,
  price_pence       int  not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  blocked_until     timestamptz not null, -- ends_at + buffer at time of booking
  status            text not null default 'pending'
                    check (status in ('pending','confirmed','rejected','cancelled','completed','no_show')),
  experience        text,
  student_message   text,
  admin_notes       text not null default '',
  payment_mode      text not null default 'pay_at_lesson',
  payment_status    text not null default 'unpaid'
                    check (payment_status in ('unpaid','authorised','paid','refunded','not_required')),
  amount_due_pence  int not null default 0,
  manage_token_hash text not null,
  cancelled_at      timestamptz,
  cancelled_by      text check (cancelled_by in ('student','admin','system')),
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_until >= ends_at),
  -- The core double-booking guarantee: no two active bookings may overlap, even under concurrent requests.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, blocked_until) with &&
  ) where (status in ('pending','confirmed'))
);
create index if not exists bookings_starts_at_idx on bookings (starts_at);
create index if not exists bookings_status_idx on bookings (status);
create index if not exists bookings_student_idx on bookings (student_id);

-- Genuine student reviews, entered by the instructor. Nothing is shown until published.
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  author_name text not null,
  body        text not null,
  rating      smallint check (rating between 1 and 5),
  source      text,
  published   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Payment records (provider-agnostic; ready for Stripe or others).
create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  provider     text not null,
  provider_ref text,             -- e.g. Stripe Checkout Session id
  provider_payment_id text,      -- e.g. Stripe PaymentIntent id
  amount_pence int not null,
  status       text not null check (status in ('created','authorised','paid','cancelled','refunded','failed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists payments_booking_idx on payments (booking_id);
create unique index if not exists payments_provider_ref_key on payments (provider, provider_ref) where provider_ref is not null;

-- Every email the system sends (or would send, before a provider is configured).
create table if not exists email_log (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  to_address text not null,
  subject    text not null,
  body_text  text not null,
  provider   text not null,
  status     text not null check (status in ('sent','logged','failed')),
  error      text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on email_log (created_at desc);

-- Booking audit trail.
create table if not exists booking_events (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  actor      text not null,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_events_booking_idx on booking_events (booking_id, created_at);

-- Simple DB-backed rate limiting (works on serverless).
create table if not exists rate_limits (
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_key_idx on rate_limits (key, created_at);

-- Supabase exposes the public schema over its REST API. Lock every table down:
-- the app connects server-side with the database connection string, which bypasses RLS.
alter table settings            enable row level security;
alter table admin_users         enable row level security;
alter table lesson_types        enable row level security;
alter table weekly_hours        enable row level security;
alter table schedule_exceptions enable row level security;
alter table students            enable row level security;
alter table bookings            enable row level security;
alter table payments            enable row level security;
alter table email_log           enable row level security;
alter table booking_events      enable row level security;
alter table rate_limits         enable row level security;
alter table reviews             enable row level security;
