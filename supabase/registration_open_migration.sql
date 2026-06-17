-- 1. Add registration open fields to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_opens_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_notified BOOLEAN DEFAULT FALSE;

-- 2. Enable extensions needed for cron + HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Schedule cron job every 5 minutes
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY with the actual key from
--            Supabase Dashboard → Project Settings → API → service_role key
SELECT cron.schedule(
  'notify-registration-open',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjljktituvuamjwksuxg.supabase.co/functions/v1/notify-registration-open',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- To verify the job was created:
-- SELECT * FROM cron.job;

-- To remove the job if needed:
-- SELECT cron.unschedule('notify-registration-open');
