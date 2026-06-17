-- Assign existing Woeva Picks events to their city-specific clubs
-- Run once in Supabase SQL editor after woeva_picks_cities.sql has been executed
-- Woeva admin creator_id: ceeafc86-7da8-442d-ac22-2e06ce363973

-- Normalize city aliases first, then update club_id on each event
UPDATE events e
SET club_id = c.id
FROM clubs c
WHERE
  -- Only scraped/Woeva Picks events (source is set)
  e.source IS NOT NULL
  -- Match city (handle Wien→Vienna, Praha→Prague aliases)
  AND c.city = CASE e.city
    WHEN 'Wien'   THEN 'Vienna'
    WHEN 'Praha'  THEN 'Prague'
    ELSE e.city
  END
  -- Only Woeva Picks city clubs
  AND c.creator_id = 'ceeafc86-7da8-442d-ac22-2e06ce363973'
  AND c.name LIKE 'Woeva Picks %'
  -- Don't overwrite existing club_id if already set correctly
  AND (e.club_id IS NULL OR e.club_id != c.id);

-- Show what was updated
SELECT e.title, e.city, e.club_id, c.name AS club_name
FROM events e
JOIN clubs c ON c.id = e.club_id
WHERE e.source IS NOT NULL
  AND c.creator_id = 'ceeafc86-7da8-442d-ac22-2e06ce363973'
ORDER BY e.city, e.date;
