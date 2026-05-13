import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Previous month range
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodLabel = start.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
  const periodStart = start.toISOString();
  const periodEnd = end.toISOString();

  // Get all creators who had paid attendees last month
  const { data: rows } = await admin
    .from('event_attendees')
    .select('events!inner(creator_id)')
    .eq('paid', true)
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd);

  const creatorIds = [...new Set((rows ?? []).map((r: any) => r.events?.creator_id).filter(Boolean))];

  const results: any[] = [];

  for (const creatorId of creatorIds) {
    // Skip if invoice already exists for this creator+period
    const { data: existing } = await admin
      .from('invoices')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('period_label', periodLabel)
      .maybeSingle();

    if (existing) { results.push({ creatorId, status: 'skipped' }); continue; }

    // Get creator billing info
    const { data: billing } = await admin
      .from('creator_billing')
      .select('*')
      .eq('user_id', creatorId)
      .maybeSingle();

    // Call generate-invoice
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ creatorId, periodStart, periodEnd, periodLabel, billingInfo: billing ?? null }),
    });

    const data = await res.json();
    results.push({ creatorId, status: res.ok ? 'created' : 'error', data });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
