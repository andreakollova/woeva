-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  bio text,
  city text default 'Bratislava',
  interests text[] default '{}',
  phone text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can read all profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────────
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  tagline text,
  category text,
  cover_url text,
  date date not null,
  time text not null,
  duration numeric default 2,
  venue text,
  lat numeric,
  lng numeric,
  price numeric default 0,
  going_count integer default 0,
  is_free boolean default true,
  city text default 'Bratislava',
  created_at timestamptz default now()
);

alter table events enable row level security;
create policy "Events are publicly readable" on events for select using (true);
create policy "Authenticated users can create events" on events for insert with check (auth.uid() = creator_id);
create policy "Creators can update their events" on events for update using (auth.uid() = creator_id);
create policy "Creators can delete their events" on events for delete using (auth.uid() = creator_id);

-- ─────────────────────────────────────────────
-- EVENT ATTENDEES
-- ─────────────────────────────────────────────
create table if not exists event_attendees (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  paid boolean default false,
  payment_intent_id text,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

alter table event_attendees enable row level security;
create policy "Attendees are public" on event_attendees for select using (true);
create policy "Users can join events" on event_attendees for insert with check (auth.uid() = user_id);
create policy "Users can leave events" on event_attendees for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- CLUBS
-- ─────────────────────────────────────────────
create table if not exists clubs (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  tagline text,
  category text,
  cover_url text,
  member_count integer default 1,
  rating numeric default 0,
  city text default 'Bratislava',
  created_at timestamptz default now()
);

alter table clubs enable row level security;
create policy "Clubs are public" on clubs for select using (true);
create policy "Auth users can create clubs" on clubs for insert with check (auth.uid() = creator_id);
create policy "Admins can update clubs" on clubs for update using (auth.uid() = creator_id);

-- ─────────────────────────────────────────────
-- CLUB MEMBERS
-- ─────────────────────────────────────────────
create table if not exists club_members (
  id uuid primary key default uuid_generate_v4(),
  club_id uuid references clubs(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  status text default 'approved' check (status in ('approved', 'pending')),
  joined_at timestamptz default now(),
  unique(club_id, user_id)
);

alter table club_members enable row level security;
create policy "Members are public" on club_members for select using (true);
create policy "Auth users can join clubs" on club_members for insert with check (auth.uid() = user_id);
create policy "Users can leave clubs" on club_members for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  rating integer check (rating between 1 and 5) not null,
  comment text,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

alter table reviews enable row level security;
create policy "Reviews are public" on reviews for select using (true);
create policy "Auth users can review" on reviews for insert with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- CHAT ROOMS + MESSAGES
-- ─────────────────────────────────────────────
create table if not exists chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  type text default 'event',
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references chat_rooms(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "Attendees can read messages" on messages for select using (
  exists (
    select 1 from event_attendees ea
    join chat_rooms cr on cr.event_id = ea.event_id
    where cr.id = messages.room_id and ea.user_id = auth.uid()
  )
);
create policy "Attendees can send messages" on messages for insert with check (
  auth.uid() = sender_id and
  exists (
    select 1 from event_attendees ea
    join chat_rooms cr on cr.event_id = ea.event_id
    where cr.id = room_id and ea.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────────
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  type text check (type in ('inappropriate', 'spam', 'harassment')) not null,
  target_id uuid not null,
  reporter_id uuid references profiles(id) on delete cascade not null,
  reason text,
  status text default 'open' check (status in ('open', 'in_review', 'closed')),
  created_at timestamptz default now()
);

alter table reports enable row level security;
create policy "Reporters can submit reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "Admins can read reports" on reports for select using (auth.uid() = reporter_id);

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('event-covers', 'event-covers', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('club-covers', 'club-covers', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

create policy "Public read event covers" on storage.objects for select using (bucket_id = 'event-covers');
create policy "Auth upload event covers" on storage.objects for insert with check (bucket_id = 'event-covers' and auth.uid() is not null);
create policy "Public read club covers" on storage.objects for select using (bucket_id = 'club-covers');
create policy "Auth upload club covers" on storage.objects for insert with check (bucket_id = 'club-covers' and auth.uid() is not null);
create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Auth upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);
create policy "Auth update avatars" on storage.objects for update using (bucket_id = 'avatars' and auth.uid() is not null);
