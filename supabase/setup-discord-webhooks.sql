-- Run this in Supabase SQL Editor to set up database webhooks
-- that call the discord-activity-notify Edge Function.
--
-- Prerequisites:
-- 1. Deploy the discord-activity-notify Edge Function
-- 2. Set DISCORD_ACTIVITY_WEBHOOK_URL secret in Supabase dashboard
--    (Project Settings → Edge Functions → Secrets)
--    Use a Discord webhook URL from your server channel
-- 3. Enable the pg_net extension (already enabled on most Supabase projects)

-- Enable pg_net if not already enabled
create extension if not exists pg_net schema extensions;

-- ── Helper: call edge function via HTTP ────────────────────────────────────────
-- Replace YOUR_PROJECT_REF with your Supabase project ref (from project URL)

-- ── Trigger: new event created ────────────────────────────────────────────────
create or replace function notify_discord_event_created()
returns trigger language plpgsql as $$
begin
  perform extensions.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'events',
      'record', row_to_json(NEW)
    )::text
  );
  return NEW;
end;
$$;

drop trigger if exists trg_discord_event_created on events;
create trigger trg_discord_event_created
  after insert on events
  for each row execute function notify_discord_event_created();

-- ── Trigger: event cancelled ───────────────────────────────────────────────────
create or replace function notify_discord_event_cancelled()
returns trigger language plpgsql as $$
begin
  if OLD.status != 'cancelled' and NEW.status = 'cancelled' then
    perform extensions.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-activity-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'events',
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_discord_event_cancelled on events;
create trigger trg_discord_event_cancelled
  after update on events
  for each row execute function notify_discord_event_cancelled();

-- ── Trigger: user joined event ────────────────────────────────────────────────
create or replace function notify_discord_attendee_joined()
returns trigger language plpgsql as $$
begin
  perform extensions.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'event_attendees',
      'record', row_to_json(NEW)
    )::text
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
  perform extensions.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-activity-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'DELETE',
      'table', 'event_attendees',
      'old_record', row_to_json(OLD)
    )::text
  );
  return OLD;
end;
$$;

drop trigger if exists trg_discord_attendee_left on event_attendees;
create trigger trg_discord_attendee_left
  after delete on event_attendees
  for each row execute function notify_discord_attendee_left();
