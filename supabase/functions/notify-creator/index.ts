import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { type, eventId, clubId, attendeeName } = await req.json();

    if (type === 'event_join' && eventId) {
      // Get event + creator + club owner + admins
      const { data: event } = await db.from('events').select('title, creator_id, club_id, date').eq('id', eventId).single();
      if (!event?.creator_id) return new Response('no creator', { status: 200 });

      const dateStr = event.date ? new Date(event.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' }) : '';
      const title = dateStr ? `${event.title} | ${dateStr}` : event.title;
      const body = `${attendeeName} sa registroval/a na tvoj event.`;

      // Collect all recipients: event creator + club owner + club admins
      const recipientIds = new Set<string>();
      recipientIds.add(event.creator_id);

      if (event.club_id) {
        const { data: club } = await db.from('clubs').select('creator_id').eq('id', event.club_id).single();
        if (club?.creator_id) recipientIds.add(club.creator_id);
        const { data: admins } = await db.from('club_members').select('user_id').eq('club_id', event.club_id).eq('role', 'admin').eq('status', 'approved');
        (admins ?? []).forEach((a: any) => recipientIds.add(a.user_id));
      }

      const ids = [...recipientIds];

      // In-app notifications for all
      await db.from('notifications').insert(
        ids.map(uid => ({ user_id: uid, type: 'join', title, body, data: { event_id: eventId } }))
      );

      // Push to all with tokens
      const { data: profiles } = await db
        .from('profiles').select('push_token')
        .in('id', ids)
        .or('notifications_enabled.is.null,notifications_enabled.eq.true')
        .not('push_token', 'is', null);

      const tokens = [...new Set(
        (profiles ?? []).map((p: any) => p.push_token).filter((t: any) => t?.startsWith('ExponentPushToken['))
      )];

      if (tokens.length > 0) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ tokens, title, body, data: { event_id: eventId } }),
        });
      }
    }

    if (type === 'event_leave' && eventId) {
      const { data: event } = await db.from('events').select('title, creator_id, date').eq('id', eventId).single();
      if (!event?.creator_id) return new Response('no creator', { status: 200 });

      const dateStr = event.date ? new Date(event.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' }) : '';
      const title = dateStr ? `${event.title} | ${dateStr}` : event.title;
      const body = `${attendeeName} zrušil/a svoju účasť na tvojom evente.`;

      await db.from('notifications').insert({
        user_id: event.creator_id,
        type: 'leave',
        title,
        body,
        data: { event_id: eventId },
      });

      const { data: creatorProfile } = await db
        .from('profiles').select('push_token')
        .eq('id', event.creator_id)
        .or('notifications_enabled.is.null,notifications_enabled.eq.true')
        .not('push_token', 'is', null)
        .single();

      if (creatorProfile?.push_token?.startsWith('ExponentPushToken[')) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ tokens: [creatorProfile.push_token], title, body, data: { event_id: eventId } }),
        });
      }
    }

    if (type === 'club_join' && clubId) {
      // Get club + all admins (creator + role=admin members)
      const { data: club } = await db.from('clubs').select('name, creator_id').eq('id', clubId).single();
      if (!club) return new Response('no club', { status: 200 });

      const adminIds = new Set<string>();
      if (club.creator_id) adminIds.add(club.creator_id);
      const { data: adminMembers } = await db
        .from('club_members').select('user_id')
        .eq('club_id', clubId).eq('role', 'admin').eq('status', 'approved');
      (adminMembers ?? []).forEach((m: any) => adminIds.add(m.user_id));

      if (adminIds.size === 0) return new Response('no admins', { status: 200 });

      const ids = [...adminIds];
      const title = `Woeva`;
      const body = `${attendeeName} začal/a sledovať tvoj klub.`;

      // In-app notifications for all admins
      await db.from('notifications').insert(
        ids.map(uid => ({ user_id: uid, type: 'join', title: `Nový sledovateľ`, body, data: { club_id: clubId } }))
      );

      // Push to all admins with token
      const { data: adminProfiles } = await db
        .from('profiles').select('push_token').in('id', ids)
        .or('notifications_enabled.is.null,notifications_enabled.eq.true')
        .not('push_token', 'is', null);

      const tokens = [...new Set(
        (adminProfiles ?? []).map((p: any) => p.push_token).filter((t: any) => t?.startsWith('ExponentPushToken['))
      )];

      if (tokens.length > 0) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ tokens, title, body, data: { club_id: clubId, type: 'club_join' } }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('notify-creator error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
