import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  try {
    // Find events where registration just opened and notification hasn't been sent yet
    const { data: events, error } = await db
      .from('events')
      .select('id, title, club_id, creator_id, category')
      .lte('registration_opens_at', new Date().toISOString())
      .eq('registration_notified', false)
      .not('registration_opens_at', 'is', null);

    if (error) throw error;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    }

    let totalNotified = 0;

    for (const event of events) {
      // Mark as notified immediately to prevent duplicate sends
      await db
        .from('events')
        .update({ registration_notified: true })
        .eq('id', event.id);

      if (!event.club_id) continue;

      const { data: club } = await db
        .from('clubs')
        .select('name')
        .eq('id', event.club_id)
        .single();

      // Get all approved club members except the creator
      const { data: members } = await db
        .from('club_members')
        .select('user_id')
        .eq('club_id', event.club_id)
        .eq('status', 'approved')
        .neq('user_id', event.creator_id ?? '');

      if (!members || members.length === 0) continue;

      const userIds = [...new Set(members.map((m: any) => m.user_id))];

      const pushTitle = `Otvára sa prihlasovanie!`;
      const pushBody = `${event.title}${club?.name ? ` · ${club.name}` : ''}`;

      // Save in-app notifications
      const notifications = userIds.map((uid: string) => ({
        user_id: uid,
        type: 'registration_open',
        title: pushTitle,
        body: pushBody,
        data: { event_id: event.id },
      }));
      await db.from('notifications').insert(notifications);

      // Get push tokens
      const { data: profiles } = await db
        .from('profiles')
        .select('push_token')
        .in('id', userIds)
        .neq('notifications_enabled', false)
        .not('push_token', 'is', null);

      const tokens = [...new Set(
        (profiles ?? [])
          .map((p: any) => p.push_token)
          .filter((t: any) => t && t.startsWith('ExponentPushToken['))
      )];

      if (tokens.length > 0) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            tokens,
            title: pushTitle,
            body: pushBody,
            data: { event_id: event.id },
          }),
        });
      }

      totalNotified += userIds.length;
    }

    return new Response(JSON.stringify({ ok: true, processed: events.length, notified: totalNotified }), { status: 200 });
  } catch (err) {
    console.error('notify-registration-open error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
