import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    const { tokens, title, body, data } = await req.json();

    if (!tokens || !tokens.length || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: tokens, title, body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validTokens = tokens.filter((t: string) => t && t.startsWith('ExponentPushToken['));

    if (validTokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no valid tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = validTokens.map((token: string) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data ?? {},
    }));

    const BATCH_SIZE = 100;
    const results = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + BATCH_SIZE)),
      });
      results.push(await res.json());
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length, batches: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
