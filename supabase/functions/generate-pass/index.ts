import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import forge from 'npm:node-forge@1.3.1';
import JSZip from 'npm:jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sha1Hex(data: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(forge.util.binary.raw.encode(data));
  return md.digest().toHex();
}

async function buildPass(supabase: any, userId: string, event_id: string): Promise<Uint8Array> {
  const { data: event } = await supabase.from('events').select('*').eq('id', event_id).single();
  if (!event) throw new Error('Event not found');

  const { data: attendee } = await supabase
    .from('event_attendees')
    .select('id')
    .eq('event_id', event_id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!attendee) throw new Error('Not attending');

  const passTypeId = Deno.env.get('PASS_TYPE_ID')!;
  const teamId = Deno.env.get('TEAM_ID')!;

  const venueLabel = [event.venue, event.city].filter(Boolean).join(', ');

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    serialNumber: attendee.id,
    teamIdentifier: teamId,
    organizationName: 'Woeva',
    description: event.title,
    foregroundColor: 'rgb(10, 10, 10)',
    backgroundColor: 'rgb(201, 255, 71)',
    labelColor: 'rgb(10, 10, 10)',
    eventTicket: {
      headerFields: [
        ...(venueLabel ? [{ key: 'venue', label: 'MIESTO', value: venueLabel }] : []),
      ],
      primaryFields: [{ key: 'event', label: 'PODUJATIE', value: event.title }],
      secondaryFields: [
        ...(event.date ? [{ key: 'date', label: 'DÁTUM', value: event.date }] : []),
      ],
      auxiliaryFields: [
        ...(event.time ? [{ key: 'time', label: 'ČAS', value: event.time }] : []),
      ],
      backFields: [
        { key: 'ticketId', label: 'ID LÍSTKA', value: attendee.id },
        { key: 'holder', label: 'DRŽITEĽ LÍSTKA', value: '' },
        ...(event.price > 0 ? [{ key: 'price', label: 'ZAPLATENÁ CENA', value: `€${Number(event.price).toFixed(2)}` }] : []),
      ],
    },
    barcodes: [{ message: attendee.id, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' }],
  };

  const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson));
  const manifest = { 'pass.json': sha1Hex(passJsonBytes) };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  const cert = forge.pki.certificateFromPem(Deno.env.get('PASS_CERT')!);
  const key = forge.pki.privateKeyFromPem(Deno.env.get('PASS_KEY')!);
  const wwdr = forge.pki.certificateFromPem(Deno.env.get('WWDR_CERT')!);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(forge.util.binary.raw.encode(manifestBytes));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key, certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  });
  p7.sign({ detached: true });

  const sigDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const signatureBytes = forge.util.binary.raw.decode(sigDer);

  const zip = new JSZip();
  zip.file('pass.json', passJsonBytes);
  zip.file('manifest.json', manifestBytes);
  zip.file('signature', signatureBytes);

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    // GET: called from Safari via Linking.openURL — returns binary .pkpass directly
    // Safari recognises application/vnd.apple.pkpass and shows "Add to Apple Wallet"
    if (req.method === 'GET') {
      const event_id = url.searchParams.get('event_id');
      const token = url.searchParams.get('token');
      if (!event_id || !token) return new Response('Missing params', { status: 400 });

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Response('Unauthorized', { status: 401 });

      const pkpass = await buildPass(supabase, user.id, event_id);

      return new Response(pkpass, {
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'attachment; filename="woeva-ticket.pkpass"',
        },
      });
    }

    // POST: generate pass, upload to Storage, return signed URL
    // App opens signed URL in Safari → iOS recognises .pkpass → Add to Wallet dialog
    const { event_id } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const pkpass = await buildPass(supabase, user.id, event_id);

    // Return binary directly — Vercel proxy will stream it to Safari as .pkpass
    return new Response(pkpass, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="woeva-ticket.pkpass"',
      },
    });

  } catch (err) {
    console.error('generate-pass error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
