-- Coordinators: users who can only scan QR codes and confirm check-ins
-- event_id = null means all events for that club
create table if not exists coordinators (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id),
  status text not null default 'active', -- active | removed
  created_at timestamptz default now(),
  unique nulls not distinct (club_id, event_id, user_id)
);

alter table coordinators enable row level security;

-- Coordinators can see their own assignments; club admins/creators can see all
create policy "coordinators_select" on coordinators for select using (
  user_id = auth.uid()
  or exists (select 1 from clubs where id = coordinators.club_id and creator_id = auth.uid())
  or exists (select 1 from club_members where club_id = coordinators.club_id and user_id = auth.uid() and role = 'admin' and status = 'approved')
);

-- Only club admins/creators can add coordinators
create policy "coordinators_insert" on coordinators for insert with check (
  exists (select 1 from clubs where id = club_id and creator_id = auth.uid())
  or exists (select 1 from club_members where club_id = coordinators.club_id and user_id = auth.uid() and role = 'admin' and status = 'approved')
);

-- Only club admins/creators can update (e.g. set status = 'removed')
create policy "coordinators_update" on coordinators for update using (
  exists (select 1 from clubs where id = coordinators.club_id and creator_id = auth.uid())
  or exists (select 1 from club_members where club_id = coordinators.club_id and user_id = auth.uid() and role = 'admin' and status = 'approved')
);

-- check_ins: coordinators can also insert (scan QR and confirm)
drop policy if exists "check_ins_insert_coordinator" on check_ins;
create policy "check_ins_insert_coordinator" on check_ins for insert with check (
  exists (
    select 1 from coordinators
    where user_id = auth.uid() and status = 'active'
    and club_id = (select club_id from events where id = check_ins.event_id limit 1)
    and (event_id is null or event_id = check_ins.event_id)
  )
);

-- check_ins: coordinators can select check-ins for their events
drop policy if exists "check_ins_select_coordinator" on check_ins;
create policy "check_ins_select_coordinator" on check_ins for select using (
  exists (
    select 1 from coordinators
    where user_id = auth.uid() and status = 'active'
    and club_id = (select club_id from events where id = check_ins.event_id limit 1)
    and (event_id is null or event_id = check_ins.event_id)
  )
);
