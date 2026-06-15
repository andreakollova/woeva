ALTER TABLE profiles ADD COLUMN IF NOT EXISTS muted_chats text[] DEFAULT '{}';
