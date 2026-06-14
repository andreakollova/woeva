import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushMessages(messages: object[]) {
  if (!messages.length) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().split('T')[0];
  const in7Str = in7days.toISOString().split('T')[0];

  // Upcoming events in next 7 days
  const { data: events } = await db
    .from('events')
    .select('id, title, city, category')
    .gte('date', todayStr)
    .lte('date', in7Str)
    .neq('status', 'cancelled');

  if (!events?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const byCity: Record<string, typeof events> = {};
  for (const e of events) {
    if (!e.city) continue;
    byCity[e.city] = byCity[e.city] ?? [];
    byCity[e.city].push(e);
  }

  // Users who opted into discovery notifications
  const { data: users } = await db
    .from('profiles')
    .select('id, city, interests, push_token, notif_new_event_my_tags, notif_new_event_all, last_weekly_rec')
    .eq('notifications_enabled', true)
    .not('push_token', 'is', null)
    .not('city', 'is', null);

  if (!users?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const messages: object[] = [];
  const notifiedIds: string[] = [];

  for (const user of users) {
    if (!user.push_token || (!user.notif_new_event_my_tags && !user.notif_new_event_all)) continue;

    // Max once per 6 days
    if (user.last_weekly_rec) {
      const daysSince = (now.getTime() - new Date(user.last_weekly_rec).getTime()) / 86400000;
      if (daysSince < 6) continue;
    }

    const cityEvents = byCity[user.city] ?? [];
    if (!cityEvents.length) continue;

    const interests: string[] = user.interests ?? [];
    let pick = cityEvents[Math.floor(Math.random() * cityEvents.length)];

    // Try to find interest-matched event
    if (interests.length > 0 && user.notif_new_event_my_tags) {
      const matched = cityEvents.find(e =>
        interests.some(i => (e.category ?? '').toLowerCase().includes(i.toLowerCase()))
      );
      if (matched) pick = matched;
    }

    messages.push({
      to: user.push_token,
      title: pick.title,
      body: 'Možno ťa to zaujme tento týždeň 👀',
      data: { event_id: pick.id, type: 'weekly_rec' },
      sound: 'default',
    });
    notifiedIds.push(user.id);
  }

  // Send in batches of 100 (Expo limit)
  for (let i = 0; i < messages.length; i += 100) {
    await sendPushMessages(messages.slice(i, i + 100));
  }

  // Update last_weekly_rec for notified users
  if (notifiedIds.length) {
    await db.from('profiles')
      .update({ last_weekly_rec: now.toISOString() })
      .in('id', notifiedIds);
  }

  return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
