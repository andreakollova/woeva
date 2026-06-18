create table if not exists pending_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  role text not null check (role in ('admin', 'coordinator')),
  event_id uuid references events(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by uuid references auth.users(id),
  club_name text not null default '',
  inviter_name text not null default '',
  status text not null default 'pending', -- pending | accepted | declined
  accepted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);

alter table pending_invites enable row level security;

-- Anyone can read invite by token (needed for the invite screen before login)
create policy "pending_invites_select" on pending_invites for select using (true);

-- Club admins/creators can insert invites
create policy "pending_invites_insert" on pending_invites for insert with check (
  exists (select 1 from clubs where id = club_id and creator_id = auth.uid())
  or exists (select 1 from club_members where club_id = pending_invites.club_id and user_id = auth.uid() and role = 'admin' and status = 'approved')
);

-- Logged-in user can accept (update status)
create policy "pending_invites_update" on pending_invites for update using (auth.uid() is not null);
