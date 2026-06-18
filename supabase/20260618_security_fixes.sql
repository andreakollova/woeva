-- ═══════════════════════════════════════════════════════════════════
-- SECURITY FIXES 2026-06-18
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. CLUBS DELETE — allow creator to delete own club ─────────────

create policy "Creators can delete their clubs" on clubs for delete
  using (auth.uid() = creator_id);

-- ─── 2. CLUB MEMBERS DELETE — allow creator to delete all members ───
-- (needed when creator deletes the club)

drop policy if exists "Users can leave clubs" on club_members;
create policy "Users can leave clubs" on club_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from clubs
      where clubs.id = club_members.club_id
        and clubs.creator_id = auth.uid()
    )
  );

-- ─── 3. CLUB MEMBERS UPDATE — prevent co-admin from demoting creator ─

drop policy if exists "Club admins can manage members" on club_members;
create policy "Club admins can manage members" on club_members for update
  using (
    -- creator can change anyone
    exists (
      select 1 from clubs
      where clubs.id = club_members.club_id
        and clubs.creator_id = auth.uid()
    )
    or (
      -- co-admin can change anyone EXCEPT the creator's row
      exists (
        select 1 from club_members cm2
        where cm2.club_id = club_members.club_id
          and cm2.user_id = auth.uid()
          and cm2.role = 'admin'
          and cm2.status = 'approved'
      )
      and not exists (
        select 1 from clubs
        where clubs.id = club_members.club_id
          and clubs.creator_id = club_members.user_id
      )
    )
  );

-- ─── 4. CHECK-INS — allow co-admins to insert and read ──────────────

drop policy if exists "Event creators can insert check-ins" on check_ins;
create policy "Event creators and club admins can insert check-ins" on check_ins for insert
  with check (
    auth.role() = 'authenticated'
    and (
      exists (
        select 1 from events
        where events.id = check_ins.event_id
          and events.creator_id = auth.uid()
      )
      or exists (
        select 1 from events e
        join club_members cm on cm.club_id = e.club_id
        where e.id = check_ins.event_id
          and cm.user_id = auth.uid()
          and cm.role = 'admin'
          and cm.status = 'approved'
      )
    )
  );

drop policy if exists "Event creators can read check-ins" on check_ins;
create policy "Event creators and club admins can read check-ins" on check_ins for select
  using (
    exists (
      select 1 from events
      where events.id = check_ins.event_id
        and events.creator_id = auth.uid()
    )
    or exists (
      select 1 from events e
      join club_members cm on cm.club_id = e.club_id
      where e.id = check_ins.event_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
        and cm.status = 'approved'
    )
  );
