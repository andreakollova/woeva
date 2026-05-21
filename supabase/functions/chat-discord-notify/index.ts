import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    const eventId = record.room_id;
    const content = record.content;
    const senderId = record.sender_id;
    if (!eventId || !content) return new Response('ok');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: event }, { data: profile }] = await Promise.all([
      supabase.from('events').select('title').eq('id', eventId).single(),
      supabase.from('profiles').select('name').eq('id', senderId).single(),
    ]);

    const eventTitle = event?.title ?? 'Unknown event';
    const senderName = profile?.name ?? 'Someone';
    const chatLink = `https://woeva-oscar.vercel.app/chat/${eventId}`;

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')!;
    const channelId = Deno.env.get('DISCORD_CHANNEL_ID')!;

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `💬 **${senderName}** in *${eventTitle}*:\n> ${content.slice(0, 500)}\n[Open chat](${chatLink})`,
      }),
    });

    return new Response('ok');
  } catch (err) {
    console.error('chat-discord-notify error:', err);
    return new Response('error', { status: 500 });
  }
});
