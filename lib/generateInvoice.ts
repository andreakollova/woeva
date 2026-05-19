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

const WOEVA_LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAYEAAAGBCAYAAACAWQ0kAAAACXBIWXMAAAsSAAALEgHS3X78AAAgAElEQVR4nO3deZhU1Z0+8Pfcpap637tpmm5ommZHQUBBiLghrhk1xmgmC/ObjOOYGA2MW0Dv1LhrNEYnJjEZYyabySRO1LgL2oqAKCqIIrKvTbN2N71V1b3n/P5oe4ZxQBuorlOn+v08j4/Po1D1dt+q8733rAARERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERHT2hO4AungenOYQSAbfSdlSZDfhBYDUdiMV3VQKt0SjiujMS0dG7wkN2yIlUhF2/Wth2gZLoSviq0Y7Hd+R3f8d93RnTQb8pAp4Hqy3iTigqxxWV1XJm1WA5sKgUoXCWErbd/Wf8BNDVKeS+3Yg1bhHbGrfaLzbvVY/ndvrLWBSI0ttVHnKzc8OnlZbLrw2sCaYNqFZlRaXKDYUhLAtQCvATUO1tQu7eIdq2bbRWNzXiz63N9n8V+7GN0Sik7p9Bh4wvAtd6KCysDM0bP8W/cnC9zA1Huv+7+JyfXKnuf2KdwOa1Vuuq5favt25L/MsjUezp+9RE1Ftz7wiNrhws7x53YjBzwCAVdkOf//0Gur/fUgJtLUKt+0DsXP2ufZuzP/GL/nbDl7FF4CoPuQOr3R9On+XPLqtUjmUd/Wv1fFiatorE4oXOo41bE//8cBRtyUtLREfqO7dGautH+L866fRgel6hEsf6HfcTwIaPrLa3XrVvcPYnHukv3UUZWQRuuDd83innJf5zyHCZdSwfjEMJAmDNCqvlzQWhi+65oeuV5L46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tPx4l2rpiqGps0NsinWKjzs78X4slthYAexjVw8RERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER0Wf5/+3W6qfhatRvAAAAAElFTkSuQmCC';


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
  .brand img { width: 44px; height: 44px; }
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
        <th style="text-align:right">Woeva (3.5%)</th>
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
    <div class="totals-row"><span>Woeva (3.5%)</span><span style="color:#888">- ${fmt(totalWoeva)}</span></div>
    <div class="totals-row total"><span>Celkový čistý príjem</span><span>${fmt(totalNet)}</span></div>
  </div>

  <div class="note">
    <strong>Podmienky výplaty:</strong> Výplaty sú spracovávané automaticky cez Stripe Connect každý pondelok. Môže trvať 2–5 pracovných dní, kým suma dorazí na váš bankový účet. Stripe poplatok je 1.5% + €0.25 za transakciu. Poplatok platformy Woeva je 3.5% z hrubého príjmu.
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
  .brand img { width: 44px; height: 44px; }
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
  .due { display: inline-block; margin-top: 8px; background: #0a0a0a; color: #C8FF00; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
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
        <th style="text-align:right">Woeva (3.5%)</th>
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
    <div class="totals-row"><span>Woeva (3.5%)</span><span style="color:#888">− ${fmt(totalWoeva)}</span></div>
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
