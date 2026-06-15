ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring_open_weekday smallint DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurring_open_time text DEFAULT NULL;
