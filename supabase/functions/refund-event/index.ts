import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader || (!authHeader.includes(serviceKey) && !authHeader.startsWith('Bearer '))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { eventId } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: attendees } = await supabase
    .from('event_attendees')
    .select('id, user_id, payment_intent_id')
    .eq('event_id', eventId)
    .eq('paid', true)
    .not('payment_intent_id', 'is', null);

  const results = [];
  for (const a of attendees ?? []) {
    try {
      const refund = await stripe.refunds.create({ payment_intent: a.payment_intent_id });
      results.push({ user_id: a.user_id, status: 'refunded', refund_id: refund.id });
    } catch (e: any) {
      results.push({ user_id: a.user_id, status: 'failed', error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
