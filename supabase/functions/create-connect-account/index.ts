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
    const { return_url } = await req.json();

    // Check existing account
    const { data: existing } = await admin
      .from('stripe_accounts')
      .select('stripe_account_id, onboarding_complete, payouts_enabled')
      .eq('user_id', user.id)
      .single();

    let accountId = existing?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'SK',
        email: user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        settings: { payouts: { schedule: { interval: 'weekly', weekly_anchor: 'monday' } } },
      });
      accountId = account.id;

      await admin.from('stripe_accounts').insert({
        user_id: user.id,
        stripe_account_id: accountId,
        onboarding_complete: false,
        payouts_enabled: false,
        charges_enabled: false,
      });
    }

    if (existing?.onboarding_complete) {
      // Already connected — check live status and update
      const account = await stripe.accounts.retrieve(accountId);
      await admin.from('stripe_accounts').update({
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        onboarding_complete: account.details_submitted,
      }).eq('user_id', user.id);

      return new Response(JSON.stringify({ already_connected: true, payouts_enabled: account.payouts_enabled }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: return_url,
      return_url: return_url,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const detail = err?.raw?.message ?? err?.message ?? String(err);
    console.error('create-connect-account error:', detail);
    return new Response(JSON.stringify({ error: detail }), {
      status: 200, // return 200 so client can read the body
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
