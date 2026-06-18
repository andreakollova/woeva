import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WOEVA_ADMIN_ID = 'ceeafc86-7da8-442d-ac22-2e06ce363973';

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record ?? body;

    if (!record?.id) {
      return new Response('skip: no record id', { status: 200 });
    }

    let clubIds: string[] = [];
    let clubName = 'Woeva Picks';

    if (record.source) {
      // ── Woeva Picks event — find city-specific club ──────────────────────────
      // Normalize city aliases (Wien → Vienna, Praha → Prague)
      const CITY_NORMALIZE: Record<string, string> = { Wien: 'Vienna', Praha: 'Prague' };
      const rawCity: string = record.city ?? '';
      const city = CITY_NORMALIZE[rawCity] ?? rawCity;

      if (!city) return new Response('skip: no city on woeva picks event', { status: 200 });

      const { data: cityClub } = await db
        .from('clubs')
        .select('id, name')
        .eq('creator_id', WOEVA_ADMIN_ID)
        .eq('city', city)
        .ilike('name', 'Woeva Picks%')
        .maybeSingle();

      if (!cityClub) return new Response(`skip: no Woeva Picks club for city ${city}`, { status: 200 });

      clubIds = [cityClub.id];
      clubName = cityClub.name?.toLowerCase().startsWith('woeva picks') ? 'Woeva Picks' : cityClub.name;
    } else if (record.club_id) {
      // ── User-created club event ───────────────────────────────────────────────
      const { data: club } = await db.from('clubs').select('name').eq('id', record.club_id).single();
      clubIds = [record.club_id];
      clubName = club?.name ?? 'Klub';
    } else {
      // Pure user event with no club — skip
      return new Response('skip: no source and no club_id', { status: 200 });
    }

    // Idempotency: skip if we already sent notifications for this event
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'club_event')
      .contains('data', { event_id: record.id });
    if ((count ?? 0) > 0) {
      return new Response('already notified', { status: 200 });
    }

    // Get approved members from the club, excluding the creator
    const { data: members } = await db
      .from('club_members')
      .select('user_id')
      .in('club_id', clubIds)
      .eq('status', 'approved')
      .neq('user_id', record.creator_id ?? '');

    if (!members || members.length === 0) {
      return new Response('no members', { status: 200 });
    }

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
    const pushTitle = `${clubName} zdieľa nový event!`;

    // In-app notifications
    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: 'club_event',
      title: pushTitle,
      body: `${record.title} ${emoji}`,
      data: { event_id: record.id },
    }));
    if (notifications.length > 0) {
      await db.from('notifications').insert(notifications);
    }

    // Push tokens
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
          body: `${record.title} ${emoji}`,
          data: { event_id: record.id },
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: userIds.length, club: clubName }), { status: 200 });
  } catch (err) {
    console.error('notify-club-event error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
