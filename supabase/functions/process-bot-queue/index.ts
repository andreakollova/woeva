import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all due bot attendances
  const { data: jobs } = await db
    .from('bot_attendance_queue')
    .select('id, event_id, bot_id')
    .eq('processed', false)
    .lte('scheduled_at', new Date().toISOString())
    .limit(50);

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }));
  }

  let processed = 0;
  for (const job of jobs) {
    const { error } = await db.from('event_attendees').upsert(
      { event_id: job.event_id, user_id: job.bot_id, paid: false },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true }
    );

    if (!error) {
      await db.from('bot_attendance_queue').update({ processed: true }).eq('id', job.id);
      processed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }));
});
