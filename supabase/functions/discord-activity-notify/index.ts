import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WEBHOOK_URL = Deno.env.get('DISCORD_ACTIVITY_WEBHOOK_URL')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sendEmbed(embed: Record<string, unknown>) {
  if (!WEBHOOK_URL) return;
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('sk-SK', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

serve(async (req) => {
  try {
    const body = await req.json();
    console.log('discord-activity-notify body:', JSON.stringify(body));

    // Direct call (e.g. from delete-account) — has a `type` field at root
    if (body.type === 'account_deleted') {
      const { name, email, event_count, club_count, attendee_count } = body;
      await sendEmbed({
        title: '🗑️ Zmazaný účet',
        color: 0xEF4444,
        fields: [
          { name: 'Používateľ', value: `${name} (${email})`, inline: false },
          { name: 'Vytvorené eventy', value: String(event_count ?? 0), inline: true },
          { name: 'Prihlásení účastníci (zrušení)', value: String(attendee_count ?? 0), inline: true },
          { name: 'Kluby', value: String(club_count ?? 0), inline: true },
        ],
        timestamp: new Date().toISOString(),
      });
      return new Response('ok');
    }

    // Supabase DB webhook payload
    const { type, table, record, old_record } = body;

    // ── New event created ────────────────────────────────────────────────────
    if (table === 'events' && type === 'INSERT') {
      const { data: creator } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', record.creator_id)
        .single();

      const price = record.price > 0
        ? `€${Number(record.price).toFixed(2)}`
        : 'Zadarmo';

      await sendEmbed({
        title: '🎉 Nový event',
        color: 0x3B82F6,
        fields: [
          { name: 'Názov', value: record.title, inline: false },
          { name: 'Organizátor', value: creator?.name ?? record.creator_id, inline: true },
          { name: 'Email', value: creator?.email ?? '—', inline: true },
          { name: 'Dátum', value: fmtDate(record.date), inline: true },
          { name: 'Mesto', value: record.city ?? '—', inline: true },
          { name: 'Cena', value: price, inline: true },
          { name: 'Kapacita', value: record.max_attendees ? String(record.max_attendees) : 'Neobmedzená', inline: true },
        ],
        timestamp: new Date().toISOString(),
      });
      return new Response('ok');
    }

    // ── Event cancelled / status change ─────────────────────────────────────
    if (table === 'events' && type === 'UPDATE' &&
        old_record?.status !== 'cancelled' && record?.status === 'cancelled') {
      const { data: creator } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', record.creator_id)
        .single();

      const { count } = await supabase
        .from('event_attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', record.id);

      await sendEmbed({
        title: '🚫 Event zrušený',
        color: 0xF97316,
        fields: [
          { name: 'Názov', value: record.title, inline: false },
          { name: 'Organizátor', value: creator?.name ?? '—', inline: true },
          { name: 'Email', value: creator?.email ?? '—', inline: true },
          { name: 'Dátum', value: fmtDate(record.date), inline: true },
          { name: 'Počet prihlásených', value: String(count ?? 0), inline: true },
        ],
        timestamp: new Date().toISOString(),
      });
      return new Response('ok');
    }

    // ── User joined event ────────────────────────────────────────────────────
    if (table === 'event_attendees' && type === 'INSERT') {
      const [{ data: user }, { data: event }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', record.user_id).single(),
        supabase.from('events').select('title, date, price, city, ticket_type').eq('id', record.event_id).single(),
      ]);

      const paid = record.paid
        ? `€${Number(event?.price ?? 0).toFixed(2)}`
        : (event?.ticket_type === 'pay_at_door' ? 'Platba pri vstupe' : 'Zadarmo');

      await sendEmbed({
        title: '✅ Prihlásenie na event',
        color: 0x22C55E,
        fields: [
          { name: 'Používateľ', value: user?.name ?? record.user_id, inline: true },
          { name: 'Email', value: user?.email ?? '—', inline: true },
          { name: 'Event', value: event?.title ?? record.event_id, inline: false },
          { name: 'Dátum eventu', value: event?.date ? fmtDate(event.date) : '—', inline: true },
          { name: 'Mesto', value: event?.city ?? '—', inline: true },
          { name: 'Platba', value: paid, inline: true },
        ],
        timestamp: new Date().toISOString(),
      });
      return new Response('ok');
    }

    // ── User left event ──────────────────────────────────────────────────────
    if (table === 'event_attendees' && type === 'DELETE') {
      const [{ data: user }, { data: event }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', old_record.user_id).single(),
        supabase.from('events').select('title, date, city').eq('id', old_record.event_id).single(),
      ]);

      await sendEmbed({
        title: '↩️ Odhlásenie z eventu',
        color: 0xEAB308,
        fields: [
          { name: 'Používateľ', value: user?.name ?? old_record.user_id, inline: true },
          { name: 'Email', value: user?.email ?? '—', inline: true },
          { name: 'Event', value: event?.title ?? old_record.event_id, inline: false },
          { name: 'Dátum eventu', value: event?.date ? fmtDate(event.date) : '—', inline: true },
          { name: 'Mesto', value: event?.city ?? '—', inline: true },
          { name: 'Bolo zaplatené', value: old_record.paid ? 'Áno' : 'Nie', inline: true },
        ],
        timestamp: new Date().toISOString(),
      });
      return new Response('ok');
    }

    return new Response('ok');
  } catch (err) {
    console.error('discord-activity-notify error:', err);
    return new Response('error', { status: 500 });
  }
});
