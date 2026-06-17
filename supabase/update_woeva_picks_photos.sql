-- Set same logo + cover for all Woeva Picks city clubs
UPDATE clubs
SET
  logo_url  = 'https://cjljktituvuamjwksuxg.supabase.co/storage/v1/object/public/club-logos/580bd767-7f59-4dcc-bcb4-6be7c647bb27_logo_1778688592039.jpg',
  cover_url = 'https://cjljktituvuamjwksuxg.supabase.co/storage/v1/object/public/club-covers/580bd767-7f59-4dcc-bcb4-6be7c647bb27_cover_1778688592039.jpg'
WHERE creator_id = 'ceeafc86-7da8-442d-ac22-2e06ce363973'
  AND name LIKE 'Woeva Picks %';
