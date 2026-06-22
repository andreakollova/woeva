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

const WOEVA_LOGO_B64 = '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';


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
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 36px; width: auto; }
  .brand-name { font-size: 26px; font-weight: 900; letter-spacing: -1px; }
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
    <div class="brand"><img src="data:image/png;base64,${WOEVA_LOGO_B64}" alt="Woeva" /><span class="brand-name">Woeva</span></div>
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
      <p>DIČ: 2122213775</p>
      <p>Mudrochova 7480/15</p><p>831 06 Bratislava</p>
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
        <th style="text-align:center">POČET</th>
        <th style="text-align:right">Hrubý príjem</th>
        <th style="text-align:right">Stripe poplatok</th>
        <th style="text-align:right">Poplatok Woeva (4 % + €0,50 / lístok)</th>
        <th style="text-align:right">Čistý príjem</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px">Žiadne platené eventy v tomto období</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Hrubý príjem</span><span>${fmt(totalGross)}</span></div>
    <div class="totals-row"><span>Stripe (1.5% + €0.25)</span><span style="color:#888">- ${fmt(totalStripe)}</span></div>
    <div class="totals-row"><span>Poplatok Woeva (4 % + €0,50 / lístok)</span><span style="color:#888">- ${fmt(totalWoeva)}</span></div>
    <div class="totals-row total"><span>Celkový čistý príjem</span><span>${fmt(totalNet)}</span></div>
  </div>

  <div class="note">
    <strong>Podmienky výplaty:</strong> Výplaty sú spracovávané automaticky cez Stripe Connect každý pondelok. Môže trvať 2–5 pracovných dní, kým suma dorazí na váš bankový účet. Stripe poplatok je 1.5% + €0.25 za transakciu. Poplatok Woeva je 4 % z ceny lístka + €0,50 za každý predaný lístok.
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
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 36px; width: auto; }
  .brand-name { font-size: 26px; font-weight: 900; letter-spacing: -1px; }
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
  .due { display: inline-block; margin-top: 8px; background: #0a0a0a; color: #B9FF00; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand"><img src="data:image/png;base64,${WOEVA_LOGO_B64}" alt="Woeva" /><span class="brand-name">Woeva</span></div>
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
      <p>DIČ: 2122213775</p>
      <p>Mudrochova 7480/15</p><p>831 06 Bratislava</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Event</th>
        <th>Dátum</th>
        <th style="text-align:center">POČET</th>
        <th style="text-align:right">Hrubý príjem</th>
        <th style="text-align:right">Stripe poplatok</th>
        <th style="text-align:right">Poplatok Woeva (4 % + €0,50 / lístok)</th>
        <th style="text-align:right">Čistý výnos</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px">Žiadne platené eventy v tomto období</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Hrubý príjem</span><span>${fmt(totalGross)}</span></div>
    <div class="totals-row"><span>Stripe (1.5% + €0.25)</span><span style="color:#888">− ${fmt(totalStripe)}</span></div>
    <div class="totals-row"><span>Poplatok Woeva (4 % + €0,50 / lístok)</span><span style="color:#888">− ${fmt(totalWoeva)}</span></div>
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
  .brand span { color: #B9FF00; background: #0a0a0a; padding: 2px 8px; border-radius: 6px; }
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
