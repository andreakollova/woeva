import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateReceiptHtml(
  eventTitle: string,
  eventDate: string,
  venueName: string | null,
  amount: number,
  attendeeName: string,
  receiptNumber: string
): string {
  const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  const eventDateFmt = new Date(eventDate + 'T00:00:00').toLocaleDateString('sk-SK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0a0a0a; max-width: 480px; margin: 0 auto; }
  .brand { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 32px; }
  .brand span { color: #C8FF00; background: #0a0a0a; padding: 2px 8px; border-radius: 6px; }
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
  .sub { color: #888; font-size: 13px; margin-bottom: 32px; }
  .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .detail-label { color: #888; }
  .total-row { display: flex; justify-content: space-between; padding: 16px 0; font-weight: 800; font-size: 18px; border-top: 2px solid #0a0a0a; margin-top: 8px; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
</style>
</head>
<body>
  <div class="brand"><span>W</span> Woeva</div>
  <h1>Potvrdenie o platbe</h1>
  <p class="sub">Č. ${receiptNumber} &nbsp;·&nbsp; ${today}</p>
  <div class="detail-row"><span class="detail-label">Účastník</span><span>${attendeeName}</span></div>
  <div class="detail-row"><span class="detail-label">Event</span><span>${eventTitle}</span></div>
  <div class="detail-row"><span class="detail-label">Dátum eventu</span><span>${eventDateFmt}</span></div>
  ${venueName ? `<div class="detail-row"><span class="detail-label">Miesto</span><span>${venueName}</span></div>` : ''}
  <div class="detail-row"><span class="detail-label">Platba</span><span>Stripe</span></div>
  <div class="total-row"><span>Zaplatená suma</span><span>€${amount.toFixed(2)}</span></div>
  <div class="footer">Woeva — woeva.app &nbsp;·&nbsp; Generované automaticky</div>
</body>
</html>`;
}

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

    const { eventId, paymentIntentId } = await req.json();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [{ data: event }, { data: profile }] = await Promise.all([
      admin.from('events').select('title, date, venue, price').eq('id', eventId).single(),
      admin.from('profiles').select('name').eq('id', user.id).single(),
    ]);

    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

    const receiptNumber = `WOE-R-${Date.now().toString(36).toUpperCase()}`;
    const attendeeName = profile?.name ?? user.email ?? 'Účastník';

    const finalHtml = generateReceiptHtml(
      event.title,
      event.date,
      event.venue ?? null,
      event.price ?? 0,
      attendeeName,
      receiptNumber
    );

    // Log revenue
    const stripeFee = parseFloat(((event.price ?? 0) * 0.029 + 0.30).toFixed(2));
    const woeva_fee = parseFloat(((event.price ?? 0) * 0.05).toFixed(2));
    const net = parseFloat(((event.price ?? 0) - stripeFee - woeva_fee).toFixed(2));
    await admin.from('platform_revenue').insert({
      event_id: eventId,
      user_id: user.id,
      payment_intent_id: paymentIntentId,
      gross: event.price ?? 0,
      stripe_fee: stripeFee,
      woeva_fee,
      net,
    });

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Woeva <noreply@woeva.app>',
        to: [user.email!],
        subject: `Potvrdenie — ${event.title}`,
        html: finalHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data }), { status: res.status, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
