-- Run this in Supabase SQL Editor
-- Requires: notify-club-event deployed with --no-verify-jwt

create or replace function notify_club_event_created()
returns trigger language plpgsql as $$
begin
  if NEW.club_id is not null then
    perform net.http_post(
      url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/notify-club-event',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQzMTcsImV4cCI6MjA5Mjk2MDMxN30.8KToU2sarmrqvcO8cXlhs4vDA1TC-sOMyg4Mm8NCNxI'
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_club_event on events;
create trigger trg_notify_club_event
  after insert on events
  for each row execute function notify_club_event_created();
