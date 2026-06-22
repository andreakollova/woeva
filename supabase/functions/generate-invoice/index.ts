import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Admin-only: uses service role
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { creatorId, periodStart, periodEnd, periodLabel, billingInfo } = await req.json();

    if (!creatorId || !periodLabel) {
      return new Response(JSON.stringify({ error: 'Missing creatorId or periodLabel' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Fetch all paid attendees for creator's events in period
    let query = admin
      .from('event_attendees')
      .select('event_id, payment_intent_id, events!inner(title, date, price, creator_id)')
      .eq('paid', true)
      .eq('events.creator_id', creatorId);

    if (periodStart) query = query.gte('created_at', periodStart);
    if (periodEnd) query = query.lt('created_at', periodEnd);

    const { data: attendees, error } = await query;
    if (error) throw error;

    // Aggregate per event
    const eventMap: Record<string, { title: string; date: string; paid_count: number; gross: number }> = {};
    for (const a of attendees ?? []) {
      const ev = (a as any).events;
      if (!ev) continue;
      if (!eventMap[a.event_id]) {
        eventMap[a.event_id] = { title: ev.title, date: ev.date, paid_count: 0, gross: 0 };
      }
      eventMap[a.event_id].paid_count += 1;
      eventMap[a.event_id].gross += ev.price ?? 0;
    }

    const events_data = Object.values(eventMap).map(e => {
      const stripe_fee = parseFloat((e.gross * 0.015 + 0.25 * e.paid_count).toFixed(2));
      const woeva_fee = parseFloat((e.gross * 0.04 + 0.50 * e.paid_count).toFixed(2));
      const net = parseFloat((e.gross - stripe_fee - woeva_fee).toFixed(2));
      return { ...e, stripe_fee, woeva_fee, net };
    });

    const totalGross = events_data.reduce((s, e) => s + e.gross, 0);
    const totalStripe = events_data.reduce((s, e) => s + e.stripe_fee, 0);
    const totalWoeva = events_data.reduce((s, e) => s + e.woeva_fee, 0);
    const totalNet = events_data.reduce((s, e) => s + e.net, 0);

    // Generate invoice number: WOE-YYYY-NNNNN
    const { count } = await admin.from('invoices').select('*', { count: 'exact', head: true });
    const year = new Date().getFullYear();
    const seq = String((count ?? 0) + 1).padStart(5, '0');
    const invoice_number = `WOE-${year}-${seq}`;

    const { data: invoice, error: insertError } = await admin.from('invoices').insert({
      invoice_number,
      creator_id: creatorId,
      billing_info: billingInfo ?? null,
      period_label: periodLabel,
      period_start: periodStart ?? null,
      period_end: periodEnd ?? null,
      events_data,
      gross: parseFloat(totalGross.toFixed(2)),
      stripe_fee: parseFloat(totalStripe.toFixed(2)),
      woeva_fee: parseFloat(totalWoeva.toFixed(2)),
      net: parseFloat(totalNet.toFixed(2)),
      status: 'draft',
    }).select().single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true, invoice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
