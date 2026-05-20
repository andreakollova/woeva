-- 1. Add is_bot column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- 2. Mark specific users as bots (replace UUIDs with real bot user IDs)
-- UPDATE profiles SET is_bot = true WHERE id IN ('uuid-1', 'uuid-2', 'uuid-3');

-- 3. Trigger: auto-add bots ONLY on woeva picks (source = 'scraped'), never on user-created events
CREATE OR REPLACE FUNCTION auto_add_bots_to_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.source IS NOT NULL THEN
    INSERT INTO event_attendees (event_id, user_id, paid)
    SELECT NEW.id, p.id, true
    FROM profiles p
    WHERE p.is_bot = true
      AND p.id != NEW.creator_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_bots ON events;
CREATE TRIGGER trg_auto_add_bots
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION auto_add_bots_to_event();
