import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = req.headers.get('x-internal-secret');
    if (secret !== Deno.env.get('INTERNAL_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    // Support both direct call { event_id } and Supabase DB webhook { record: { id } }
    const event_id = body.event_id ?? body.record?.id;
    if (!event_id) return new Response(JSON.stringify({ error: 'event_id required' }), { status: 400, headers: corsHeaders });

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the event
    const { data: event } = await db.from('events').select('id, city, creator_id, source').eq('id', event_id).single();
    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

    // Only add bots to Woeva Picks events
    if (event.source !== 'woeva_picks') {
      return new Response(JSON.stringify({ ok: true, added: 0, message: 'Bots only for woeva_picks' }), { headers: corsHeaders });
    }

    // Get bots from the same city (or any city if none found)
    let { data: bots } = await db
      .from('profiles')
      .select('id')
      .eq('is_bot', true)
      .ilike('city', `%${event.city ?? ''}%`);

    // Fallback: any bots if no city match
    if (!bots || bots.length === 0) {
      const { data: anyBots } = await db.from('profiles').select('id').eq('is_bot', true);
      bots = anyBots ?? [];
    }

    if (bots.length === 0) {
      return new Response(JSON.stringify({ ok: true, added: 0, message: 'No bots available' }), { headers: corsHeaders });
    }

    // Pick 1-4 random bots
    const shuffled = bots.sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 4) + 1; // 1 to 4
    const selected = shuffled.slice(0, Math.min(count, bots.length));

    // Add first bot immediately
    const firstBot = selected[0];
    await db.from('event_attendees').insert({ event_id, user_id: firstBot.id, paid: false });

    // Schedule remaining bots with delays via recursive invocation (fire & forget)
    for (let i = 1; i < selected.length; i++) {
      const botId = selected[i].id;
      // Delay: 2h to 20h between each bot (in ms, but we'll just schedule via separate call)
      const delayHours = 2 + Math.floor(Math.random() * 18); // 2-20h
      const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

      // Insert a pending bot attendance job into a queue table
      await db.from('bot_attendance_queue').insert({
        event_id,
        bot_id: botId,
        scheduled_at: scheduledAt,
      }).then(() => {});
    }

    return new Response(JSON.stringify({ ok: true, added: 1, queued: selected.length - 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
