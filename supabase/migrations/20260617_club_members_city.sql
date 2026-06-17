-- Add city preference to club_members
-- NULL = follow all cities, non-null = follow only that city
alter table club_members add column if not exists city text;
