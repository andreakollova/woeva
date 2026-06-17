-- Woeva Picks per-city clubs
-- Run once in Supabase SQL editor
-- creator_id: ceeafc86-7da8-442d-ac22-2e06ce363973 (Woeva admin)

INSERT INTO clubs (creator_id, name, tagline, city, category, member_count)
VALUES
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks Bratislava', 'Najlepšie eventy v Bratislave, kurátované Woevou', 'Bratislava', 'Community & Belonging', 1),
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks Košice',     'Najlepšie eventy v Košiciach, kurátované Woevou',  'Košice',     'Community & Belonging', 1),
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks Nitra',      'Najlepšie eventy v Nitre, kurátované Woevou',      'Nitra',      'Community & Belonging', 1),
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks Vienna',     'Best events in Vienna, curated by Woeva',          'Vienna',     'Community & Belonging', 1),
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks Prague',     'Best events in Prague, curated by Woeva',          'Prague',     'Community & Belonging', 1),
  ('ceeafc86-7da8-442d-ac22-2e06ce363973', 'Woeva Picks London',     'Best events in London, curated by Woeva',          'London',     'Community & Belonging', 1)
ON CONFLICT DO NOTHING;

-- Add admin as approved admin member of each club
INSERT INTO club_members (club_id, user_id, role, status)
SELECT id, creator_id, 'admin', 'approved'
FROM clubs
WHERE creator_id = 'ceeafc86-7da8-442d-ac22-2e06ce363973'
  AND name LIKE 'Woeva Picks %'
ON CONFLICT DO NOTHING;
