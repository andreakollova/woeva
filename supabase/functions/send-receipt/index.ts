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

  const logoBase64 = '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';

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0a0a0a; max-width: 480px; margin: 0 auto; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .brand img { width: 40px; height: 40px; border-radius: 10px; }
  .brand-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
  .sub { color: #888; font-size: 13px; margin-bottom: 32px; }
  .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .detail-label { color: #888; }
  .total-row { display: flex; justify-content: space-between; padding: 16px 0; font-weight: 800; font-size: 18px; border-top: 2px solid #0a0a0a; margin-top: 8px; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
</style>
</head>
<body>
  <div class="brand">
    <img src="data:image/png;base64,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" alt="Woeva" />
    <span class="brand-name">Woeva</span>
  </div>
  <h1>Potvrdenie o platbe</h1>
  <p class="sub">Č. ${receiptNumber} &nbsp;·&nbsp; ${today}</p>
  <div class="detail-row"><span class="detail-label">Účastník: </span><span>${attendeeName}</span></div>
  <div class="detail-row"><span class="detail-label">Event: </span><span>${eventTitle}</span></div>
  <div class="detail-row"><span class="detail-label">Dátum eventu: </span><span>${eventDateFmt}</span></div>
  ${venueName ? `<div class="detail-row"><span class="detail-label">Miesto: </span><span>${venueName}</span></div>` : ''}
  <div class="total-row"><span>Zaplatená suma</span><span> €${amount.toFixed(2)}</span></div>
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

    const { eventId, paymentIntentId, qty = 1 } = await req.json();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [{ data: event }, { data: profile }] = await Promise.all([
      admin.from('events').select('title, date, venue, price, going_count, creator_id').eq('id', eventId).single(),
      admin.from('profiles').select('name').eq('id', user.id).single(),
    ]);

    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

    const receiptNumber = `WOE-R-${Date.now().toString(36).toUpperCase()}`;
    const attendeeName = profile?.name ?? user.email ?? 'Účastník';

    const totalAmount = (event.price ?? 0) * qty;

    const finalHtml = generateReceiptHtml(
      event.title,
      event.date,
      event.venue ?? null,
      totalAmount,
      attendeeName,
      receiptNumber
    );

    // Increment going_count using service role (buyer may not have RLS permission to update events)
    await admin.from('events').update({ going_count: (event.going_count ?? 0) + qty }).eq('id', eventId);

    // Log revenue — matches create-payment-intent: 5% platform fee, minimum €0.50 per transaction
    const woeva_fee = parseFloat(Math.max(Math.round(totalAmount * 0.05 * 100) / 100, 0.50).toFixed(2));
    const stripe_fee = parseFloat((totalAmount * 0.015 + 0.25).toFixed(2));
    const net = parseFloat((woeva_fee - stripe_fee).toFixed(2)); // Woeva's profit after paying Stripe
    await admin.from('platform_revenue').insert({
      event_id: eventId,
      user_id: user.id,
      payment_intent_id: paymentIntentId,
      gross: totalAmount,
      stripe_fee,
      woeva_fee,
      net,
    });

    // Build invoice PDF link
    const invoiceUrl = `https://ticket.woeva.com/api/invoice?event_id=${eventId}&token=${encodeURIComponent(authHeader?.replace('Bearer ', '') ?? '')}`;

    // Send via Resend
    const emailHtml = `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;color:#0a0a0a;}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);}
  .header{background:#0a0a0a;padding:28px 36px;display:flex;align-items:center;}
  .header img{height:28px;}
  .body{padding:36px;}
  h1{font-size:22px;font-weight:800;margin:0 0 8px;letter-spacing:-0.4px;}
  .sub{color:#888;font-size:14px;margin-bottom:28px;}
  .event-box{background:#f7f7f7;border-radius:12px;padding:20px;margin-bottom:28px;}
  .event-name{font-size:17px;font-weight:700;margin-bottom:4px;}
  .event-meta{font-size:13px;color:#666;}
  .amount{font-size:28px;font-weight:800;color:#0a0a0a;margin-bottom:4px;}
  .amount-sub{font-size:13px;color:#888;margin-bottom:28px;}
  .btn{display:block;background:#B9FF00;color:#0a0a0a;font-size:15px;font-weight:700;text-align:center;padding:16px 24px;border-radius:50px;text-decoration:none;margin-bottom:16px;}
  .footer{padding:24px 36px;border-top:1px solid #f0f0f0;font-size:12px;color:#aaa;text-align:center;}
  .footer a{color:#aaa;text-decoration:none;}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <img src="https://woeva.com/LogoWoeva.png" alt="Woeva"/>
  </div>
  <div class="body">
    <h1>Potvrdenie o rezervácii</h1>
    <p class="sub">Ďakujeme za tvoju rezerváciu. Nižšie nájdeš faktúru v PDF.</p>
    <div class="event-box">
      <div class="event-name">${event.title}</div>
      <div class="event-meta">${new Date(event.date + 'T00:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${event.venue ? ' · ' + event.venue : ''}</div>
    </div>
    <div class="amount">€${totalAmount.toFixed(2)}</div>
    <div class="amount-sub">Platba prebehla úspešne</div>
    <a class="btn" href="${invoiceUrl}">Stiahnuť faktúru (PDF)</a>
    <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">Faktúra je vystavená spoločnosťou Sportqo s.r.o. v mene platformy Woeva.</p>
  </div>
  <div class="footer">
    <a href="https://woeva.com">woeva.com</a> &nbsp;·&nbsp; <a href="mailto:admin@woeva.com">admin@woeva.com</a>
  </div>
</div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Woeva <noreply@woeva.com>',
        to: [user.email!],
        subject: `Potvrdenie o rezervácii | WOEVA`,
        html: emailHtml,
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
