import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { eventId, amount, currency } = await req.json();
    if (!eventId || !amount || !currency) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get event + creator
    const { data: event } = await admin
      .from('events')
      .select('id, title, creator_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });
    }

    // Get organizer's connected Stripe account
    const { data: stripeAccount } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', event.creator_id)
      .single();

    if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
      return new Response(JSON.stringify({ error: 'Organizer payment not set up' }), { status: 422, headers: corsHeaders });
    }

    // 5% platform fee (minimum €0.50 to cover costs)
    const applicationFee = Math.max(Math.round(amount * 0.05), 50);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
      metadata: {
        event_id: eventId,
        user_id: user.id,
        event_title: event.title,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const detail = err?.raw?.message ?? err?.message ?? String(err);
    console.error('create-payment-intent error:', detail);
    return new Response(JSON.stringify({ error: detail }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
