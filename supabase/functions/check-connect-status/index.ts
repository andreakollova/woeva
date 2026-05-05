import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: row } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!row?.stripe_account_id) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);

    await admin.from('stripe_accounts').update({
      onboarding_complete: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
    }).eq('user_id', user.id);

    // Get recent payouts
    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: row.stripe_account_id }
    );

    return new Response(JSON.stringify({
      connected: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      payouts: payouts.data.map(p => ({
        id: p.id,
        amount: p.amount / 100,
        currency: p.currency,
        status: p.status,
        arrival_date: new Date(p.arrival_date * 1000).toISOString(),
        created: new Date(p.created * 1000).toISOString(),
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
