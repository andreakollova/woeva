import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import forge from 'https://esm.sh/node-forge@1.3.1';
import JSZip from 'https://esm.sh/jszip@3.10.1';

// Woeva pass images — embedded as base64 (black wordmark on transparent bg for logo, lime app icon)
const LOGO_B64 = "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";
const LOGO_2X_B64 = "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";
const ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAADXElEQVR4nO2WTWhcVRTHf+e+N/PeTCejbU0tRqMUtErBimDRhZu0FOxSihsVEUGQCC7qVxd+0IWI7iRduKlIVVy5EEEMrUVKagtpqVJSoUghDYGYduo04yQz8969cu7LSD4mk0hpQeqBWcy7957f+fif+5784HDcZDM3G6j2P/QWKa9zYNPrc6znnV0jVOcnJ1AKrg+q5/MmS6ArVDfkgalJ4cRR46OVfwnT/eLg52OGSxeFvCwH/wPVBU3urxl4d0/EW7tivv4gpDhfqrVYmuD3f3sw5M2BmP07IyrTQjjvv2OmgcBMTbgyAcbArz8GtDTyNaar+7SNZ48axEB1WqhWMr90gurzBLi917HhLrAWqpeFeisLYOEhjVpFsqxsBhrA1Snx6+WNjvWbwRdKOmUqkFoohtDbn3mrTIr/LSyPBmMEYpNloP/bgej/akWYHs8Id9ztKN/mSNziai0Wks2EdO+2zFPtTxgfM+TaY2ShYCBpwYXzhrlZKJrsefvspd+E6h8Z4Z6HLHEHTSwbGcU9sMNixJFY4dxx4wWWphng/GnD4KMxrz0W8cr2mNFjhnUmW9eKjI0YGi1BcDz4uO2ofrO0J03wm8sbdNFxZtgwk0AkcOWy8P7TeS6eM97Z5AXhwN6IiXHx5Z51MPp94M8VS7DtSev9eU2sBFXFNSz09Tm27rC+D7+fNYweCejLwaF3QqbGDT1lRxjDujJcqwifvp6jN4SxM4axE8af27Ldct/9job2sxu03Vct0+6XElIHJoAv3gs5+EnIkc9C4tgRFR0fDTdYv9mRzztGvgkY+jjk8/0539/UCQMvpMTSecal45eDhcDBvp0Rv/wUUCo5ZmtQLMPMNeHVoSYvDyZ89WXAh89FlHqy9agAs3XY8rBj6OQcQQTOX1GrZNoWUxDAG4ea9G+11GqCSkKBz+xrsXcwYaIJTz2b8uKBpr/FrBPqdWFTv+Ptw00KheXz2T1TBTsoCFytCMOHAz/wjwykPLHLMqeXg+9FpujTI4ZT3wX0bHTsfj5l052Ous7zCi/OFaFtsL5xCgturPqSQdceKlhnWa0OtLoA1VQzK5rePHqbVOfFoDAV1qI9Bur67pwPXde7AVeFtkHBKruWBvLf+Vy50WZuOIFbGfo3YMVIqoDMGoYAAAAASUVORK5CYII=";
const ICON_2X_B64 = "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";

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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

  // Format date as YYYY-MM-DD regardless of how it comes from the DB
  let dateValue = event.date as string | undefined;
  if (dateValue) {
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      dateValue = `${y}-${m}-${day}`;
    }
  }

  // Try to fetch event strip image
  let stripBytes: Uint8Array | null = null;
  if (event.image_url) {
    try {
      const imgRes = await fetch(event.image_url);
      if (imgRes.ok) stripBytes = new Uint8Array(await imgRes.arrayBuffer());
    } catch (_) { /* skip if unavailable */ }
  }

  const passJson: any = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    serialNumber: attendee.id,
    teamIdentifier: teamId,
    organizationName: 'Woeva',
    description: event.title,
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(10, 10, 10)',
    labelColor: 'rgb(150, 150, 150)',
    eventTicket: {
      headerFields: [
        ...(event.price > 0 ? [{ key: 'price', label: 'CENA', value: `€${Number(event.price).toFixed(2)}` }] : []),
      ],
      primaryFields: [{ key: 'event', label: 'EVENT', value: event.title }],
      secondaryFields: [
        ...(dateValue ? [{ key: 'date', label: 'DATE', value: dateValue }] : []),
        ...(event.time ? [{ key: 'time', label: 'TIME', value: event.time, textAlignment: 'PKTextAlignmentRight' }] : []),
      ],
      auxiliaryFields: [
        ...(venueLabel ? [{ key: 'venue', label: 'VENUE', value: venueLabel }] : []),
      ],
      backFields: [
        { key: 'ticketId', label: 'ID LÍSTKA', value: attendee.id },
        { key: 'holder', label: 'DRŽITEĽ LÍSTKA', value: '' },
        ...(event.price > 0 ? [{ key: 'price', label: 'ZAPLATENÁ CENA', value: `€${Number(event.price).toFixed(2)}` }] : []),
      ],
    },
    barcodes: [{ message: `woeva:event:${event_id}:${userId}`, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' }],
  };

  const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson));

  // Decode embedded pass images
  const logoBytes = b64ToBytes(LOGO_B64);
  const logo2xBytes = b64ToBytes(LOGO_2X_B64);
  const iconBytes = b64ToBytes(ICON_B64);
  const icon2xBytes = b64ToBytes(ICON_2X_B64);

  const manifest: Record<string, string> = {
    'pass.json': sha1Hex(passJsonBytes),
    'logo.png': sha1Hex(logoBytes),
    'logo@2x.png': sha1Hex(logo2xBytes),
    'icon.png': sha1Hex(iconBytes),
    'icon@2x.png': sha1Hex(icon2xBytes),
  };
  if (stripBytes) {
    manifest['strip.png'] = sha1Hex(stripBytes);
    manifest['strip@2x.png'] = sha1Hex(stripBytes);
  }
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
  zip.file('logo.png', logoBytes);
  zip.file('logo@2x.png', logo2xBytes);
  zip.file('icon.png', iconBytes);
  zip.file('icon@2x.png', icon2xBytes);
  if (stripBytes) {
    zip.file('strip.png', stripBytes);
    zip.file('strip@2x.png', stripBytes);
  }

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
