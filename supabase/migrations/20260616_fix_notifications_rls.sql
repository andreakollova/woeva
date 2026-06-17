-- Allow any authenticated user to insert notifications for any user_id
-- (needed for system notifications: club join, event join, etc.)
DROP POLICY IF EXISTS "authenticated_can_insert_notifications" ON notifications;
CREATE POLICY "authenticated_can_insert_notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);
