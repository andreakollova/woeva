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

function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { event_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: event } = await supabase.from('events').select('*').eq('id', event_id).single();
    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

    const { data: attendee } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!attendee) return new Response(JSON.stringify({ error: 'Not attending' }), { status: 403, headers: corsHeaders });

    const passTypeId = Deno.env.get('PASS_TYPE_ID')!;
    const teamId = Deno.env.get('TEAM_ID')!;

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
        primaryFields: [
          { key: 'event', label: 'EVENT', value: event.title },
        ],
        secondaryFields: [
          ...(event.date ? [{ key: 'date', label: 'DATE', value: event.date }] : []),
          ...(event.time ? [{ key: 'time', label: 'TIME', value: event.time }] : []),
        ],
        auxiliaryFields: [
          ...(event.venue ? [{ key: 'venue', label: 'VENUE', value: [event.venue, event.city].filter(Boolean).join(', ') }] : []),
        ],
        backFields: [
          { key: 'ticketId', label: 'TICKET ID', value: attendee.id },
          { key: 'holder', label: 'TICKET HOLDER', value: user.email ?? '' },
          ...(event.price > 0 ? [{ key: 'price', label: 'PRICE PAID', value: `€${Number(event.price).toFixed(2)}` }] : []),
        ],
      },
      barcodes: [{
        message: attendee.id,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      }],
    };

    const passJsonBytes = new TextEncoder().encode(JSON.stringify(passJson));
    const manifest = { 'pass.json': sha1Hex(passJsonBytes) };
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

    // Parse certs/key
    const certPem = Deno.env.get('PASS_CERT')!;
    const keyPem = Deno.env.get('PASS_KEY')!;
    const wwdrPem = Deno.env.get('WWDR_CERT')!;

    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(keyPem);
    const wwdr = forge.pki.certificateFromPem(wwdrPem);

    // PKCS7 detached signature
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(forge.util.binary.raw.encode(manifestBytes));
    p7.addCertificate(cert);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key,
      certificate: cert,
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

    // Create ZIP
    const zip = new JSZip();
    zip.file('pass.json', passJsonBytes);
    zip.file('manifest.json', manifestBytes);
    zip.file('signature', signatureBytes);

    const pkpass = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

    // Return base64 JSON — avoids binary response issues in React Native
    const base64 = uint8ToBase64(pkpass);

    return new Response(JSON.stringify({ pass: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-pass error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
