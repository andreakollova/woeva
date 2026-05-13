// Generates HTML invoices for expo-print
// generateCreatorInvoice  — earnings summary (Woeva → Creator)
// generateFormalInvoice   — formal invoice (Creator → Sportqo s. r. o.) with WOE-YYYY-NNNNN numbering

export type BillingInfo = {
  company_name: string;
  ico: string;
  dic: string | null;
  address: string;
  city: string;
  country: string;
};

export type InvoiceEvent = {
  title: string;
  date: string;
  paid_count: number;
  gross: number;
  stripe_fee: number;
  woeva_fee: number;
  net: number;
};

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

export function generateCreatorInvoice(
  billing: BillingInfo,
  events: InvoiceEvent[],
  period: string,
  invoiceNumber: string
): string {
  const totalGross = events.reduce((s, e) => s + e.gross, 0);
  const totalStripe = events.reduce((s, e) => s + e.stripe_fee, 0);
  const totalWoeva = events.reduce((s, e) => s + e.woeva_fee, 0);
  const totalNet = events.reduce((s, e) => s + e.net, 0);
  const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = events.map(e => `
    <tr>
      <td>${e.title}</td>
      <td>${new Date(e.date + 'T00:00:00').toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td style="text-align:center">${e.paid_count}</td>
      <td style="text-align:right">${fmt(e.gross)}</td>
      <td style="text-align:right;color:#888">${fmt(e.stripe_fee)}</td>
      <td style="text-align:right;color:#888">${fmt(e.woeva_fee)}</td>
      <td style="text-align:right;font-weight:700">${fmt(e.net)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0a0a0a; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .brand span { color: #C8FF00; background: #0a0a0a; padding: 2px 8px; border-radius: 6px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 20px; margin: 0 0 4px; }
  .invoice-meta p { margin: 2px 0; color: #666; }
  .billing { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .billing-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 0 0 8px; }
  .billing-block p { margin: 2px 0; font-size: 13px; }
  .billing-block .main { font-weight: 700; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; border-bottom: 1px solid #e0e0e0; padding: 8px 6px; text-align: left; }
  td { padding: 10px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  .totals { margin-left: auto; width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
  .totals-row.total { border-top: 2px solid #0a0a0a; border-bottom: none; font-weight: 800; font-size: 15px; padding-top: 10px; margin-top: 4px; }
  .note { margin-top: 40px; padding: 16px; background: #f8f8f8; border-radius: 8px; font-size: 12px; color: #666; line-height: 1.6; }
  .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand"><span>W</span> Woeva</div>
    <div class="invoice-meta">
      <h2>Prehľad zárobkov</h2>
      <p>Číslo: ${invoiceNumber}</p>
      <p>Obdobie: ${period}</p>
      <p>Dátum vystavenia: ${today}</p>
    </div>
  </div>

  <div class="billing">
    <div class="billing-block">
      <h3>Platforma</h3>
      <p class="main">Sportqo s. r. o.</p>
      <p>IČO: 56132433</p>
      <p>woeva.app</p>
    </div>
    <div class="billing-block">
      <h3>Príjemca</h3>
      <p class="main">${billing.company_name}</p>
      <p>IČO: ${billing.ico}</p>
      ${billing.dic ? `<p>DIČ: ${billing.dic}</p>` : ''}
      <p>${billing.address}</p>
      <p>${billing.city}, ${billing.country}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Event</th>
        <th>Dátum</th>
        <th style="text-align:center">Tickets</th>
        <th style="text-align:right">Hrubý príjem</th>
        <th style="text-align:right">Stripe poplatok</th>
        <th style="text-align:right">Woeva poplatok (5%)</th>
        <th style="text-align:right">Čistý príjem</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px">Žiadne platené eventy v tomto období</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Hrubý príjem</span><span>${fmt(totalGross)}</span></div>
    <div class="totals-row"><span>Stripe poplatky (2.9% + €0.30)</span><span style="color:#888">- ${fmt(totalStripe)}</span></div>
    <div class="totals-row"><span>Woeva platforma (5%)</span><span style="color:#888">- ${fmt(totalWoeva)}</span></div>
    <div class="totals-row total"><span>Celkový čistý príjem</span><span>${fmt(totalNet)}</span></div>
  </div>

  <div class="note">
    <strong>Podmienky výplaty:</strong> Výplaty sú spracovávané automaticky cez Stripe Connect každý pondelok. Môže trvať 2–5 pracovných dní, kým suma dorazí na váš bankový účet. Stripe poplatok je 2.9% + €0.30 za transakciu. Poplatok platformy Woeva je 5% z hrubého príjmu (zahŕňa Stripe poplatky).
  </div>

  <div class="footer">Woeva — woeva.app &nbsp;·&nbsp; Generované automaticky ${today}</div>
</body>
</html>`;
}

// ─── Formal invoice: Creator (dodávateľ) → Sportqo s. r. o. (odberateľ) ───────────

export function generateFormalInvoice(
  billing: BillingInfo,
  events: InvoiceEvent[],
  period: string,
  invoiceNumber: string
): string {
  const totalGross = events.reduce((s, e) => s + e.gross, 0);
  const totalStripe = events.reduce((s, e) => s + e.stripe_fee, 0);
  const totalWoeva = events.reduce((s, e) => s + e.woeva_fee, 0);
  const totalNet = events.reduce((s, e) => s + e.net, 0);
  const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueDate = new Date(Date.now() + 14 * 86400000).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = events.map(e => `
    <tr>
      <td>${e.title}</td>
      <td>${new Date(e.date + 'T00:00:00').toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td style="text-align:center">${e.paid_count}</td>
      <td style="text-align:right">${fmt(e.gross)}</td>
      <td style="text-align:right;color:#888">${fmt(e.stripe_fee)}</td>
      <td style="text-align:right;color:#888">${fmt(e.woeva_fee)}</td>
      <td style="text-align:right;font-weight:700">${fmt(e.net)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0a0a0a; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .brand span { color: #C8FF00; background: #0a0a0a; padding: 2px 8px; border-radius: 6px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 24px; font-weight: 900; margin: 0 0 6px; letter-spacing: -0.5px; }
  .invoice-meta p { margin: 2px 0; color: #666; }
  .billing { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; padding: 24px; background: #f8f8f8; border-radius: 12px; }
  .billing-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 0 0 8px; }
  .billing-block p { margin: 2px 0; font-size: 13px; }
  .billing-block .main { font-weight: 700; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; border-bottom: 1px solid #e0e0e0; padding: 8px 6px; text-align: left; }
  td { padding: 10px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
  .totals-row.total { border-top: 2px solid #0a0a0a; border-bottom: none; font-weight: 800; font-size: 16px; padding-top: 10px; margin-top: 4px; }
  .note { margin-top: 40px; padding: 16px; background: #f8f8f8; border-radius: 8px; font-size: 12px; color: #666; line-height: 1.6; }
  .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; }
  .due { display: inline-block; margin-top: 8px; background: #0a0a0a; color: #C8FF00; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand"><span>W</span> Woeva</div>
    <div class="invoice-meta">
      <h2>FAKTÚRA</h2>
      <p>Číslo: <strong>${invoiceNumber}</strong></p>
      <p>Dátum vystavenia: ${today}</p>
      <p>Splatnosť: ${dueDate}</p>
      <p>Obdobie: ${period}</p>
      <div class="due">Splatnosť: ${dueDate}</div>
    </div>
  </div>

  <div class="billing">
    <div class="billing-block">
      <h3>Dodávateľ</h3>
      <p class="main">${billing.company_name}</p>
      <p>IČO: ${billing.ico}</p>
      ${billing.dic ? `<p>DIČ: ${billing.dic}</p>` : ''}
      <p>${billing.address}</p>
      <p>${billing.city}, ${billing.country}</p>
    </div>
    <div class="billing-block">
      <h3>Odberateľ</h3>
      <p class="main">Sportqo s. r. o.</p>
      <p>IČO: 56132433</p>
      <p>DIČ: SK2122213775</p>
      <p>Mudrochova 7480/15</p>
      <p>831 06 Bratislava, SK</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Event</th>
        <th>Dátum</th>
        <th style="text-align:center">Tickets</th>
        <th style="text-align:right">Hrubý príjem</th>
        <th style="text-align:right">Stripe poplatok</th>
        <th style="text-align:right">Woeva poplatok (5%)</th>
        <th style="text-align:right">Čistý výnos</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px">Žiadne platené eventy v tomto období</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Hrubý príjem</span><span>${fmt(totalGross)}</span></div>
    <div class="totals-row"><span>Stripe poplatky</span><span style="color:#888">− ${fmt(totalStripe)}</span></div>
    <div class="totals-row"><span>Woeva platforma (5%)</span><span style="color:#888">− ${fmt(totalWoeva)}</span></div>
    <div class="totals-row total"><span>Suma na úhradu</span><span>${fmt(totalNet)}</span></div>
  </div>

  <div class="note">
    <strong>Platobné podmienky:</strong> Platbu prosíme uhradiť do ${dueDate} bankovým prevodom. IBAN: SK00 0000 0000 0000 0000 0000. Variabilný symbol: ${invoiceNumber.replace(/-/g, '')}
  </div>

  <div class="footer">Woeva — woeva.app &nbsp;·&nbsp; Faktúra vygenerovaná automaticky ${today}</div>
</body>
</html>`;
}

// ─── Attendee receipt ──────────────────────────────────────────────────────────

export function generateAttendeeReceipt(
  eventTitle: string,
  eventDate: string,
  venueName: string | null,
  amount: number,
  attendeeName: string,
  receiptNumber: string
): string {
  const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  const eventDateFmt = new Date(eventDate + 'T00:00:00').toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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
  <div class="detail-row"><span class="detail-label">Platba</span><span>Stripe (karta)</span></div>
  <div class="total-row"><span>Zaplatená suma</span><span>€${amount.toFixed(2)}</span></div>

  <div class="footer">Woeva — woeva.app &nbsp;·&nbsp; Generované automaticky</div>
</body>
</html>`;
}
