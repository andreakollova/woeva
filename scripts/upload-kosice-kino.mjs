import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://cjljktituvuamjwksuxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbGprdGl0dXZ1YW1qd2tzdXhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDMxNywiZXhwIjoyMDkyOTYwMzE3fQ.FVCfWUTkJUZCk3sPCmeCTjFkx8954O4Z2WymUdROksE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const IMG_DIR = '/Users/antik/Desktop/Projekty/Woeva materialy/kosice kino';
const BUCKET = 'event-covers';
// Amfiteáter Košice – Festivalové námestie, 040 01 Košice
const LAT = 48.7195;
const LNG = 21.2477;
const BOT_ID = '00000000-0000-0000-0000-000000000001';

const FILMS = [
  {
    title: 'Diabol nosí Pradu 2',
    date: '2026-06-12', time: '21:00', duration: 2,
    description: 'Letné kino pod šírym nebom. r. D. Frankel, 2026, USA, 120 min., slovenský dabing',
    img: null,
  },
  {
    title: 'Deň odhalenia',
    date: '2026-06-13', time: '21:00', duration: 2.5,
    description: 'Letné kino pod šírym nebom. r. S. Spielberg, 2026, USA, 145 min., slovenské titulky',
    img: 'den odhalenia.jpg',
  },
  {
    title: 'Šedá zóna',
    date: '2026-06-18', time: '21:00', duration: 1.75,
    description: 'Letné kino pod šírym nebom. r. G. Ritchie, 2026, USA/Veľká Británia, 98 min., české titulky',
    img: 'seda zona.jpg',
  },
  {
    title: 'Deň odhalenia',
    date: '2026-06-19', time: '21:00', duration: 2.5,
    description: 'Letné kino pod šírym nebom. r. S. Spielberg, 2026, USA, 145 min., slovenské titulky',
    img: 'den odhalenia.jpg',
  },
  {
    title: 'Toy Story 5: Príbeh hračiek',
    date: '2026-06-20', time: '21:00', duration: 1.75,
    description: 'Letné kino pod šírym nebom. r. A. Stanton/M. Harris, 2026, USA, 102 min., slovenský dabing',
    img: 'toy story.jpg',
  },
  {
    title: 'Scary Movie',
    date: '2026-06-21', time: '21:00', duration: 1.6,
    description: 'Letné kino pod šírym nebom. r. M. Tiddes, 2026, USA, 95 min., český dabing',
    img: 'scarymovie.jpg',
  },
  {
    title: 'Supergirl',
    date: '2026-06-25', time: '21:00', duration: 1.85,
    description: 'Letné kino pod šírym nebom. r. C. Gillepsie, 2026, USA, 110 min., slovenské titulky',
    img: 'supergirl.jpg',
  },
  {
    title: 'Toy Story 5: Príbeh hračiek',
    date: '2026-06-26', time: '21:00', duration: 1.75,
    description: 'Letné kino pod šírym nebom. r. A. Stanton/M. Harris, 2026, USA, 102 min., slovenský dabing',
    img: 'toy story.jpg',
  },
  {
    title: 'Cestovateľské megakino s letiskom Košice',
    date: '2026-06-27', time: '20:30', duration: 2,
    description: 'Letné kino pod šírym nebom. Špeciálna akcia s letiskom Košice.',
    img: 'cestovatelske megakino.jpg',
  },
  {
    title: 'Top Gun – 40. výročie',
    date: '2026-06-28', time: '21:00', duration: 1.85,
    description: 'Letné kino pod šírym nebom. r. T. Scott, 1986, USA, 110 min., české titulky. Klasika oslavuje 40 rokov!',
    img: 'topgun.jpg',
  },
  {
    title: 'Star Wars: Mandalorián a Grogu',
    date: '2026-06-29', time: '21:00', duration: 2.25,
    description: 'Letné kino pod šírym nebom. r. J. Favreau, 2026, USA, 134 min., slovenský dabing',
    img: 'star wars.jpg',
  },
  {
    title: 'Mimoni a monštrá',
    date: '2026-06-30', time: '21:00', duration: 1.5,
    description: 'Letné kino pod šírym nebom. r. P. Coffin, 2026, USA, 85 min., slovenský dabing',
    img: 'mimoni.jpg',
  },
];

async function uploadImage(imgFile) {
  const filePath = `${IMG_DIR}/${imgFile}`;
  let buf;
  try { buf = readFileSync(filePath); } catch { console.error(`  ✗ File not found: ${filePath}`); return null; }
  const ext = imgFile.endsWith('.png') ? 'png' : 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const storageName = `kosice-kino-${imgFile.replace(/ /g, '-').replace('.jpg','').replace('.png','')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storageName, buf, { contentType: mime, upsert: true });
  if (error) { console.error(`  ✗ Upload error: ${error.message}`); return null; }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageName);
  return publicUrl;
}

async function run() {
  // Find Woeva Picks KE club (try both old and new name)
  const { data: clubs } = await supabase.from('clubs')
    .select('id, name')
    .or('name.eq.Woeva Picks KE,name.eq.Woeva Picks Košice,name.ilike.%Picks KE%,name.ilike.%Picks Košice%');

  const club = clubs?.[0];
  if (!club) { console.error('Could not find Woeva Picks KE club!'); return; }
  console.log(`✓ Club: ${club.name} (${club.id})`);

  // Cache image URLs to avoid re-uploading the same file twice
  const imgCache = {};

  for (const film of FILMS) {
    console.log(`\n→ ${film.date} ${film.time}  ${film.title}`);

    // Upload image (reuse if same file)
    let coverUrl = null;
    if (film.img) {
      if (!imgCache[film.img]) {
        imgCache[film.img] = await uploadImage(film.img);
        if (imgCache[film.img]) console.log(`  ✓ Image uploaded`);
      } else {
        console.log(`  ✓ Image reused`);
      }
      coverUrl = imgCache[film.img];
    }

    // Insert event
    const { data: ev, error } = await supabase.from('events').insert({
      title: `${film.title} | LETNÉ KINO`,
      date: film.date,
      time: film.time,
      duration: film.duration,
      tagline: film.description,
      venue: 'Amfiteáter Košice',
      city: 'Košice',
      lat: LAT,
      lng: LNG,
      is_free: true,
      price: 0,
      category: 'Music & Nightlife',
      cover_url: coverUrl,
      club_id: club.id,
      creator_id: BOT_ID,
      source: 'woeva-picks',
      status: 'active',
      going_count: 0,
    }).select('id').single();

    if (error) { console.error(`  ✗ Insert error: ${error.message}`); continue; }
    console.log(`  ✓ Event created: ${ev.id}`);
  }

  console.log('\n✅ Done!');
}

run().catch(console.error);
