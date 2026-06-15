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

    // Skip user-created events (no source) — they handle notifications in the app (step3.tsx)
    if (!record?.id || !record?.source) {
      return new Response('skip', { status: 200 });
    }

    // Resolve which club IDs to notify
    let clubIds: string[] = [];
    let clubName = 'Woeva Picks';

    if (!record.club_id) {
      return new Response('skip: no club_id', { status: 200 });
    }
    const { data: club } = await db.from('clubs').select('name').eq('id', record.club_id).single();
    clubIds = [record.club_id];
    clubName = club?.name ?? 'Woeva Picks';

    // Idempotency: skip if we already sent notifications for this event
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'club_event')
      .contains('data', { event_id: record.id });
    if ((count ?? 0) > 0) {
      return new Response('already notified', { status: 200 });
    }

    // Get approved members from ALL matching clubs (deduped), excluding the creator
    const { data: members } = await db
      .from('club_members')
      .select('user_id')
      .in('club_id', clubIds)
      .eq('status', 'approved')
      .neq('user_id', record.creator_id ?? '');

    if (!members || members.length === 0) {
      return new Response('no members', { status: 200 });
    }

    // Deduplicate user ids
    const userIds = [...new Set(members.map((m: any) => m.user_id))];

    const categoryEmoji: Record<string, string> = {
      'Movement & Sport': '🏃',
      'Wellness & Body': '🧘',
      'Food & Drinks': '🍽️',
      'Art & Creation': '🎨',
      'Music & Nightlife': '🎵',
      'Learning & Mind': '📚',
      'Community & Belonging': '🤝',
    };
    const emoji = categoryEmoji[record.category as string] ?? '🎉';
    const pushTitle = `Nový event od ${clubName} ${emoji}`;

    // In-app notifications
    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: 'club_event',
      title: pushTitle,
      body: record.title,
      data: { event_id: record.id },
    }));
    if (notifications.length > 0) {
      await db.from('notifications').insert(notifications);
    }

    // Push tokens — separate query, treat NULL notifications_enabled as enabled
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
          body: record.title,
          data: { event_id: record.id },
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: userIds.length }), { status: 200 });
  } catch (err) {
    console.error('notify-club-event error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
