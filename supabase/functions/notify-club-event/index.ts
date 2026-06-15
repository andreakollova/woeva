import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;

    // Only handle event inserts with a club_id
    if (!record?.club_id || !record?.id) {
      return new Response('skip', { status: 200 });
    }

    const { data: club } = await db
      .from('clubs')
      .select('name')
      .eq('id', record.club_id)
      .single();

    const clubName = club?.name ?? 'Tvoj klub';

    // Get approved members (excluding the creator)
    const { data: members } = await db
      .from('club_members')
      .select('user_id, profile:profiles(push_token)')
      .eq('club_id', record.club_id)
      .eq('status', 'approved')
      .neq('user_id', record.creator_id);

    if (!members || members.length === 0) {
      return new Response('no members', { status: 200 });
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = members.filter((m: any) => {
      if (seen.has(m.user_id)) return false;
      seen.add(m.user_id);
      return true;
    });

    // In-app notifications
    const notifications = deduped.map((m: any) => ({
      user_id: m.user_id,
      type: 'club_event',
      title: `Nový event v ${clubName}`,
      body: record.title,
      data: { event_id: record.id },
    }));
    if (notifications.length > 0) {
      await db.from('notifications').insert(notifications);
    }

    // Push notifications
    const tokens = deduped
      .map((m: any) => m.profile?.push_token)
      .filter((t: any) => t && t.startsWith('ExponentPushToken['));

    if (tokens.length > 0) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          tokens,
          title: `Nový event v ${clubName} 🎉`,
          body: record.title,
          data: { event_id: record.id },
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: deduped.length }), { status: 200 });
  } catch (err) {
    console.error('notify-club-event error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
