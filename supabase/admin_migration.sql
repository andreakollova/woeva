-- ═══════════════════════════════════════════════════════════════════
-- WOEVA ADMIN MIGRATION
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. ADMIN ROLE ─────────────────────────────────────────────────
alter table profiles add column if not exists is_admin boolean default false;

-- After running, set your admin:
-- UPDATE profiles SET is_admin = true WHERE email = 'studio@drixton.com';

-- ─── 2. CATEGORIES (DB-backed instead of hardcode) ─────────────────
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  icon text default '●',
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);
alter table categories enable row level security;
create policy "Categories are public" on categories for select using (true);
create policy "Admins can manage categories" on categories for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

insert into categories (name, sort_order) values
  ('Sport', 1), ('Coffee', 2), ('Sober party', 3), ('Party', 4), ('Music', 5),
  ('Art', 6), ('Marathon', 7), ('Film', 8), ('Yoga', 9), ('Tech', 10),
  ('Gardening', 11), ('Gaming', 12), ('Running', 13), ('Hockey', 14),
  ('Dance', 15), ('Food', 16), ('Networking', 17)
on conflict (name) do nothing;

-- ─── 3. BLACKLIST ──────────────────────────────────────────────────
create table if not exists blacklist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null unique,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table blacklist enable row level security;
create policy "Admins can manage blacklist" on blacklist for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
create policy "Users can check own blacklist" on blacklist for select
  using (auth.uid() = user_id);

-- ─── 4. ADMIN ACTIVITY LOG ─────────────────────────────────────────
create table if not exists admin_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  target_name text,
  note text,
  created_at timestamptz default now()
);
alter table admin_log enable row level security;
create policy "Admins can manage log" on admin_log for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ─── 5. PLATFORM REVENUE TRACKING ─────────────────────────────────
create table if not exists platform_revenue (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete set null,
  club_id uuid references clubs(id) on delete set null,
  creator_id uuid references profiles(id) on delete set null,
  gross numeric not null default 0,
  stripe_fee numeric not null default 0,
  woeva_fee numeric not null default 0,
  tickets_sold integer default 0,
  created_at timestamptz default now()
);
alter table platform_revenue enable row level security;
create policy "Admins can manage platform revenue" on platform_revenue for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ─── 6. INVOICES ───────────────────────────────────────────────────
create sequence if not exists invoice_seq;

create or replace function next_invoice_number()
returns text language plpgsql as $$
declare
  seq_val bigint;
  year_str text;
begin
  seq_val := nextval('invoice_seq');
  year_str := to_char(now(), 'YYYY');
  return 'WOE-' || year_str || '-' || lpad(seq_val::text, 5, '0');
end;
$$;

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique default next_invoice_number(),
  creator_id uuid references profiles(id) on delete set null,
  billing_info jsonb not null,
  period_label text not null,
  period_start date,
  period_end date,
  events_data jsonb not null default '[]',
  gross numeric not null default 0,
  stripe_fee numeric not null default 0,
  woeva_fee numeric not null default 0,
  net numeric not null default 0,
  status text default 'issued' check (status in ('draft', 'issued', 'paid')),
  created_at timestamptz default now()
);
alter table invoices enable row level security;
create policy "Creators can read own invoices" on invoices for select
  using (auth.uid() = creator_id);
create policy "Creators can insert own invoices" on invoices for insert
  with check (auth.uid() = creator_id);
create policy "Admins can manage all invoices" on invoices for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- ─── 7. FIX REPORTS RLS ────────────────────────────────────────────
drop policy if exists "Admins can read reports" on reports;
create policy "Reporter or admin can read reports" on reports for select
  using (
    auth.uid() = reporter_id
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
drop policy if exists "Admins can update reports" on reports;
create policy "Admins can update reports" on reports for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

alter table reports add column if not exists admin_note text;
alter table reports add column if not exists reviewed_by uuid references profiles(id) on delete set null;
alter table reports add column if not exists reviewed_at timestamptz;

-- ─── 8. ADMIN BYPASS POLICIES ──────────────────────────────────────

-- Admin can delete any event
drop policy if exists "Admins can delete any event" on events;
create policy "Admins can delete any event" on events for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Admin can update any event
drop policy if exists "Creators and club admins can update events" on events;
drop policy if exists "Creators club admins and platform admins can update events" on events;
create policy "Creators club admins and platform admins can update events" on events for update
  using (
    auth.uid() = creator_id
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
    or (
      club_id is not null
      and exists (
        select 1 from club_members
        where club_id = events.club_id
          and user_id = auth.uid()
          and role = 'admin'
          and status = 'approved'
      )
    )
  );

-- Admin can delete any club
drop policy if exists "Admins can delete any club" on clubs;
create policy "Admins can delete any club" on clubs for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Admin can read all messages
drop policy if exists "Attendees can read messages" on messages;
create policy "Attendees or admin can read messages" on messages for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from event_attendees ea
      join chat_rooms cr on cr.event_id = ea.event_id
      where cr.id = messages.room_id and ea.user_id = auth.uid()
    )
  );

-- Admin can delete any message
drop policy if exists "Admins can delete messages" on messages;
create policy "Sender or admin can delete messages" on messages for delete
  using (
    auth.uid() = sender_id
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Admin can read all notifications
drop policy if exists "Users see own notifications" on notifications;
create policy "Users or admin can see notifications" on notifications for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Admin can update any profile
drop policy if exists "Admins can update any profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Users or admins can update profile" on profiles for update
  using (
    auth.uid() = id
    or exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.is_admin = true)
  );

-- ─── 9. CHAT ROOMS — admin can read all ────────────────────────────
alter table chat_rooms enable row level security;
drop policy if exists "Public chat rooms" on chat_rooms;
create policy "Attendees or admin can read chat rooms" on chat_rooms for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from event_attendees
      where event_id = chat_rooms.event_id and user_id = auth.uid()
    )
  );

-- ─── 10. INDEXES ───────────────────────────────────────────────────
create index if not exists idx_categories_sort on categories(sort_order, active);
create index if not exists idx_blacklist_user on blacklist(user_id);
create index if not exists idx_invoices_creator on invoices(creator_id, created_at);
create index if not exists idx_admin_log_created on admin_log(created_at desc);
create index if not exists idx_platform_revenue_event on platform_revenue(event_id);
create index if not exists idx_reports_status on reports(status, created_at);
create index if not exists idx_profiles_admin on profiles(is_admin) where is_admin = true;
