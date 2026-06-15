-- Run this in Supabase SQL Editor
-- Requires: discord-activity-notify deployed with --no-verify-jwt
-- Requires: DISCORD_ACTIVITY_WEBHOOK_URL secret set in Supabase Edge Functions settings

create extension if not exists pg_net schema extensions;

-- Shared anon key (safe to use — function handles its own auth logic)
-- discord-activity-notify must be deployed with --no-verify-jwt

-- ── Helper function to call edge function ─────────────────────────────────────
-- We embed the anon key directly (same approach as notify-club-event trigger)

-- ── Trigger: new user registered ──────────────────────────────────────────────
create or replace function notify_discord_profile_created()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'profiles',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_discord_profile_created on profiles;
create trigger trg_discord_profile_created
  after insert on profiles
  for each row execute function notify_discord_profile_created();

-- ── Trigger: new event created ────────────────────────────────────────────────
create or replace function notify_discord_event_created()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'events',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_discord_event_created on events;
create trigger trg_discord_event_created
  after insert on events
  for each row execute function notify_discord_event_created();

-- ── Trigger: event cancelled (status → 'cancelled') ───────────────────────────
create or replace function notify_discord_event_cancelled()
returns trigger language plpgsql as $$
begin
  if OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    perform net.http_post(
      url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'events',
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_discord_event_cancelled on events;
create trigger trg_discord_event_cancelled
  after update on events
  for each row execute function notify_discord_event_cancelled();

-- ── Trigger: event deleted ────────────────────────────────────────────────────
create or replace function notify_discord_event_deleted()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
    ),
    body := jsonb_build_object(
      'type', 'DELETE',
      'table', 'events',
      'old_record', row_to_json(OLD)
    )
  );
  return OLD;
end;
$$;

drop trigger if exists trg_discord_event_deleted on events;
create trigger trg_discord_event_deleted
  after delete on events
  for each row execute function notify_discord_event_deleted();

-- ── Trigger: user joined event ────────────────────────────────────────────────
create or replace function notify_discord_attendee_joined()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'event_attendees',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_discord_attendee_joined on event_attendees;
create trigger trg_discord_attendee_joined
  after insert on event_attendees
  for each row execute function notify_discord_attendee_joined();

-- ── Trigger: user left event ──────────────────────────────────────────────────
create or replace function notify_discord_attendee_left()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
    ),
    body := jsonb_build_object(
      'type', 'DELETE',
      'table', 'event_attendees',
      'old_record', row_to_json(OLD)
    )
  );
  return OLD;
end;
$$;

drop trigger if exists trg_discord_attendee_left on event_attendees;
create trigger trg_discord_attendee_left
  after delete on event_attendees
  for each row execute function notify_discord_attendee_left();
