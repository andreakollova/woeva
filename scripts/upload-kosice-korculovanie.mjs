import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://cjljktituvuamjwksuxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDMxNywiZXhwIjoyMDkyOTYwMzE3fQ.FVCfWUTkJUZCk3sPCmeCTjFkx8954O4Z2WymUdROksE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const IMG_DIR = '/Users/antik/Desktop/Projekty/Woeva materialy/kosice korculovanie';
const BUCKET = 'event-covers';
// Aréna Sršňov – Drábova 3176/9, 040 23 Sídlisko KVP, Košice
const LAT = 48.7071;
const LNG = 21.2180;
const BOT_ID = '00000000-0000-0000-0000-000000000001';

const EVENTS = [
  {
    title: 'Hokejka a puk',
    date: '2026-06-17', time: '14:25', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 1.jpg',
  },
  {
    title: 'Verejné korčuľovanie',
    date: '2026-06-20', time: '15:30', duration: 1.0,
    tagline: 'Verejné korčuľovanie v Aréne Sršňov pre celú rodinu. Korčule si môžeš požičať priamo na mieste.',
    img: 'verejne korculovanie 1.jpg',
  },
  {
    title: 'Hokejka a puk',
    date: '2026-06-20', time: '16:45', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 2.jpg',
  },
  {
    title: 'Verejné korčuľovanie',
    date: '2026-06-21', time: '14:45', duration: 1.25,
    tagline: 'Verejné korčuľovanie v Aréne Sršňov pre celú rodinu. Korčule si môžeš požičať priamo na mieste.',
    img: 'verejne korculovanie 2.jpg',
  },
  {
    title: 'Hokejka a puk',
    date: '2026-06-21', time: '16:15', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 1.jpg',
  },
  {
    title: 'Hokejka a puk',
    date: '2026-06-24', time: '14:25', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 2.jpg',
  },
  {
    title: 'Verejné korčuľovanie',
    date: '2026-06-27', time: '15:30', duration: 1.0,
    tagline: 'Verejné korčuľovanie v Aréne Sršňov pre celú rodinu. Korčule si môžeš požičať priamo na mieste.',
    img: 'verejne korculovanie 1.jpg',
  },
  {
    title: 'Hokejka a puk',
    date: '2026-06-27', time: '16:45', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 2.jpg',
  },
  {
    title: 'Verejné korčuľovanie',
    date: '2026-06-28', time: '14:45', duration: 1.25,
    tagline: 'Verejné korčuľovanie v Aréne Sršňov pre celú rodinu. Korčule si môžeš požičať priamo na mieste.',
    img: 'verejne korculovanie 2.jpg',
  },
  {
    title: 'Hokejka a puk',
    date: '2026-06-28', time: '16:15', duration: 1.0,
    tagline: 'Hokejka a puk v Aréne Sršňov. Príď si zahrať hokej na profesionálnom ľade — hokejky a puky k dispozícii na mieste.',
    img: 'hokejka a puk 1.jpg',
  },
];

async function uploadImage(imgFile) {
  const filePath = `${IMG_DIR}/${imgFile}`;
  let buf;
  try { buf = readFileSync(filePath); } catch { console.error(`  x File not found: ${filePath}`); return null; }
  const ext = imgFile.endsWith('.png') ? 'png' : 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const storageName = `kosice-korculovanie-${imgFile.replace(/ /g, '-').replace('.jpg','').replace('.png','')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storageName, buf, { contentType: mime, upsert: true });
  if (error) { console.error(`  x Upload error: ${error.message}`); return null; }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageName);
  return publicUrl;
}

async function run() {
  const { data: clubs } = await supabase.from('clubs')
    .select('id, name')
    .or('name.eq.Woeva Picks KE,name.ilike.%Picks KE%,name.ilike.%Picks Košice%');

  const club = clubs?.[0];
  if (!club) { console.error('Could not find Woeva Picks KE club!'); return; }
  console.log(`Club: ${club.name} (${club.id})`);

  const imgCache = {};

  for (const ev of EVENTS) {
    console.log(`\n-> ${ev.date} ${ev.time}  ${ev.title}`);

    if (!imgCache[ev.img]) {
      imgCache[ev.img] = await uploadImage(ev.img);
      if (imgCache[ev.img]) console.log(`  Image uploaded`);
    } else {
      console.log(`  Image reused`);
    }

    const { data: created, error } = await supabase.from('events').insert({
      title: ev.title,
      date: ev.date,
      time: ev.time,
      duration: ev.duration,
      tagline: ev.tagline,
      venue: 'Aréna Sršňov',
      city: 'Košice',
      lat: LAT,
      lng: LNG,
      is_free: false,
      price: ev.title.includes('korčuľovanie') ? 5 : 10,
      pay_at_door: true,
      category: 'Sport & Outdoors',
      cover_url: imgCache[ev.img],
      club_id: club.id,
      creator_id: BOT_ID,
      source: 'woeva-picks',
      status: 'active',
      going_count: 0,
    }).select('id').single();

    if (error) { console.error(`  x Insert error: ${error.message}`); continue; }
    console.log(`  Event created: ${created.id}`);
  }

  console.log('\nDone!');
}

run().catch(console.error);
