import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';
import { basename } from 'path';

const SUPABASE_URL = 'https://cjljktituvuamjwksuxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDMxNywiZXhwIjoyMDkyOTYwMzE3fQ.FVCfWUTkJUZCk3sPCmeCTjFkx8954O4Z2WymUdROksE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'event-covers';

const uploads = [
  { eventTitle: 'Ranná káva & Networking',  file: '/Users/antik/Desktop/91cd9fc1-40a0-4920-8da9-3281cbd7554a_640809aa.webp', mime: 'image/webp' },
  { eventTitle: 'Joga v parku',             file: '/Users/antik/Desktop/Tuesday-Yoga_2024-07-16_Angelito-Jusay_042_web-1200x800.jpg', mime: 'image/jpeg' },
  { eventTitle: 'Večerný beh okolo hradu',  file: '/Users/antik/Desktop/Run-Clubs-hp.webp', mime: 'image/webp' },
  { eventTitle: 'Piatkovica pri Dunaji',    file: '/Users/antik/Desktop/ca-times.brightspotcdn.jpg', mime: 'image/jpeg' },
];

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) { console.error('Cannot list buckets:', error.message); return false; }
  console.log('Existing buckets:', buckets?.map(b => b.name));
  return true;
}

async function run() {
  const ok = await ensureBucket();
  if (!ok) return;

  for (const { eventTitle, file, mime } of uploads) {
    const { data: events } = await supabase.from('events').select('id, title').eq('title', eventTitle);
    const event = events?.[0];

    if (!event) {
      console.log(`No event found for: ${eventTitle}`);
      const { data: all } = await supabase.from('events').select('id, title');
      console.log('All events:', all?.map(e => e.title));
      continue;
    }

    console.log(`Uploading for: ${event.title} (${event.id})`);

    let fileBuffer;
    try { fileBuffer = readFileSync(file); } catch (e) { console.error(`File not found: ${file}`); continue; }

    const fileName = `${event.id}-${Date.now()}.${mime === 'image/webp' ? 'webp' : 'jpg'}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, fileBuffer, { contentType: mime, upsert: true });
    if (uploadError) { console.error('Upload error:', uploadError.message); continue; }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    console.log(`  URL: ${publicUrl}`);

    const { error: updateError } = await supabase.from('events').update({ cover_url: publicUrl }).eq('id', event.id);
    if (updateError) console.error('Update error:', updateError.message);
    else console.log(`  Done!`);
  }
}

run().catch(console.error);
