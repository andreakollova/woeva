-- ═══════════════════════════════════════════════════════════════════
-- WOEVA SECURITY MIGRATION
-- Run this in Supabase SQL Editor before going live
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES: add missing columns + hide push_token ─────────────

alter table profiles
  add column if not exists email text,
  add column if not exists push_token text;

-- Backfill email from auth.users for all existing users
update profiles p
  set email = u.email
  from auth.users u
  where p.id = u.id and p.email is null;

-- Function that keeps profiles.email in sync when auth email changes
create or replace function sync_profile_email()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change
  after update of email on auth.users
  for each row execute procedure sync_profile_email();

-- Also sync on signup (in case trigger fires before profile row exists, use upsert)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do update set
    name = coalesce(excluded.name, profiles.name),
    email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── 2. NOTIFICATIONS: only authenticated users can insert ───────────

drop policy if exists "Service can insert notifications" on notifications;
create policy "Authenticated users can insert notifications"
  on notifications for insert
  with check (auth.role() = 'authenticated');

-- ─── 3. CLUBS: allow co-admins to update their club ─────────────────

drop policy if exists "Admins can update clubs" on clubs;
create policy "Admins can update clubs"
  on clubs for update
  using (
    auth.uid() = creator_id
    or exists (
      select 1 from club_members
      where club_id = clubs.id
        and user_id = auth.uid()
        and role = 'admin'
        and status = 'approved'
    )
  );

-- ─── 4. EVENTS: allow club admins to update/cancel their club events ─

drop policy if exists "Creators can update their events" on events;
create policy "Creators and club admins can update events"
  on events for update
  using (
    auth.uid() = creator_id
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

-- ─── 5. CLUB MEMBERS: add update policy for invite accept/decline ────

drop policy if exists "Members can update own membership" on club_members;
create policy "Members can update own membership"
  on club_members for update
  using (auth.uid() = user_id);

-- Club owners/admins can update any member's role
drop policy if exists "Club admins can manage members" on club_members;
create policy "Club admins can manage members"
  on club_members for update
  using (
    exists (
      select 1 from clubs
      where clubs.id = club_members.club_id
        and clubs.creator_id = auth.uid()
    )
    or exists (
      select 1 from club_members cm2
      where cm2.club_id = club_members.club_id
        and cm2.user_id = auth.uid()
        and cm2.role = 'admin'
        and cm2.status = 'approved'
    )
  );

-- ─── 6. STORAGE: scope uploads to authenticated users only ───────────
-- (replace open policies with stricter ones)

drop policy if exists "Auth upload event covers" on storage.objects;
create policy "Auth upload event covers"
  on storage.objects for insert
  with check (
    bucket_id = 'event-covers'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Auth upload club covers" on storage.objects;
create policy "Auth upload club covers"
  on storage.objects for insert
  with check (
    bucket_id = 'club-covers'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Auth upload avatars" on storage.objects;
drop policy if exists "Auth update avatars" on storage.objects;
create policy "Auth upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );
create policy "Auth update avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

-- Club logos bucket
drop policy if exists "Auth update club logos" on storage.objects;
drop policy if exists "Auth upload club logos" on storage.objects;
create policy "Auth upload club logos"
  on storage.objects for insert
  with check (
    bucket_id = 'club-logos'
    and auth.role() = 'authenticated'
  );
create policy "Auth update club logos"
  on storage.objects for update
  using (
    bucket_id = 'club-logos'
    and auth.role() = 'authenticated'
  );

-- ─── 7. CHECK-INS table (used by QR scanner in dashboard) ───────────

create table if not exists check_ins (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  checked_in_at timestamptz default now(),
  unique(event_id, user_id)
);

alter table check_ins enable row level security;

create policy "Event creators can insert check-ins"
  on check_ins for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from events
      where events.id = check_ins.event_id
        and events.creator_id = auth.uid()
    )
  );

create policy "Event creators can read check-ins"
  on check_ins for select
  using (
    exists (
      select 1 from events
      where events.id = check_ins.event_id
        and events.creator_id = auth.uid()
    )
  );

-- ─── 8. BILLING INFO table (used by dashboard) ──────────────────────

create table if not exists billing_info (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null unique,
  company_name text not null,
  ico text not null,
  dic text,
  address text not null,
  city text not null,
  country text not null default 'Slovakia',
  created_at timestamptz default now()
);

alter table billing_info enable row level security;

create policy "Users can manage own billing"
  on billing_info for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── 9. STRIPE ACCOUNTS table ────────────────────────────────────────

create table if not exists stripe_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null unique,
  stripe_account_id text not null,
  onboarding_complete boolean default false,
  payouts_enabled boolean default false,
  created_at timestamptz default now()
);

alter table stripe_accounts enable row level security;

create policy "Users can manage own stripe account"
  on stripe_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── 10. PAYOUTS table ───────────────────────────────────────────────

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  amount numeric not null,
  currency text default 'eur',
  status text check (status in ('paid', 'in_transit', 'pending', 'failed')) default 'pending',
  arrival_date text,
  created text,
  stripe_payout_id text,
  created_at timestamptz default now()
);

alter table payouts enable row level security;

create policy "Users can read own payouts"
  on payouts for select
  using (auth.uid() = user_id);

-- ─── 11. Add created_at missing from club_members ────────────────────

alter table club_members
  rename column if exists joined_at to created_at;

-- If the above fails (column already named created_at), this is a no-op:
alter table club_members
  add column if not exists created_at timestamptz default now();

-- ─── 12. Rate limiting via abuse prevention ──────────────────────────
-- Prevent creating too many events in a short window (basic guard)
-- This is a server-side check that will fire on event insert

create or replace function check_event_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.events
  where creator_id = new.creator_id
    and created_at > now() - interval '1 hour';
  if recent_count >= 10 then
    raise exception 'Rate limit exceeded: too many events created recently';
  end if;
  return new;
end;
$$;

drop trigger if exists event_rate_limit on events;
create trigger event_rate_limit
  before insert on events
  for each row execute procedure check_event_rate_limit();

-- Prevent message spam (max 30 messages per minute per user per room)
create or replace function check_message_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.messages
  where sender_id = new.sender_id
    and room_id = new.room_id
    and created_at > now() - interval '1 minute';
  if recent_count >= 30 then
    raise exception 'Rate limit exceeded: sending too fast';
  end if;
  return new;
end;
$$;

drop trigger if exists message_rate_limit on messages;
create trigger message_rate_limit
  before insert on messages
  for each row execute procedure check_message_rate_limit();

-- ─── 13. Max content length constraints ─────────────────────────────

alter table messages
  add constraint message_content_length check (char_length(content) <= 1000);

alter table events
  add constraint event_title_length check (char_length(title) <= 120),
  add constraint event_tagline_length check (char_length(tagline) <= 500);

alter table profiles
  add constraint profile_name_length check (char_length(name) <= 100),
  add constraint profile_bio_length check (char_length(bio) <= 500);

alter table clubs
  add constraint club_name_length check (char_length(name) <= 80);

-- ─── 14. INDEXES for performance ─────────────────────────────────────

create index if not exists idx_events_city_date on events(city, date);
create index if not exists idx_events_status on events(status);
create index if not exists idx_events_creator on events(creator_id);
create index if not exists idx_event_attendees_event on event_attendees(event_id);
create index if not exists idx_event_attendees_user on event_attendees(user_id);
create index if not exists idx_messages_room on messages(room_id, created_at);
create index if not exists idx_notifications_user on notifications(user_id, read, created_at);
create index if not exists idx_club_members_club on club_members(club_id, status);
create index if not exists idx_club_members_user on club_members(user_id);
create index if not exists idx_profiles_email on profiles(email);
