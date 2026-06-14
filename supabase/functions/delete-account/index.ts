import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client to delete auth user
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // User client to get the caller's identity
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Could not identify user' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // 1. Get all event IDs for events the user created
    const { data: userEvents } = await adminClient
      .from('events')
      .select('id')
      .eq('creator_id', userId);

    const eventIds = (userEvents ?? []).map((e: any) => e.id);

    // 1b. Count attendees on user's events (before deletion for Discord notification)
    let totalAttendeeCount = 0;
    if (eventIds.length > 0) {
      const { count } = await adminClient
        .from('event_attendees')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds);
      totalAttendeeCount = count ?? 0;
    }

    // 1c. Fetch profile name for Discord notification
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    // 2. Delete event_attendees for user's events + user's own attendances
    if (eventIds.length > 0) {
      await adminClient.from('event_attendees').delete().in('event_id', eventIds);
    }
    await adminClient.from('event_attendees').delete().eq('user_id', userId);

    // 3. Delete messages sent by user
    await adminClient.from('messages').delete().eq('sender_id', userId);

    // 4. Delete reviews by user
    await adminClient.from('reviews').delete().eq('user_id', userId);

    // 5. Delete notifications for user
    await adminClient.from('notifications').delete().eq('user_id', userId);

    // 6. Delete club memberships
    await adminClient.from('club_members').delete().eq('user_id', userId);

    // 7. Delete events created by user
    if (eventIds.length > 0) {
      await adminClient.from('events').delete().eq('creator_id', userId);
    }

    // 8. Get clubs created by user, clean them up
    const { data: userClubs } = await adminClient
      .from('clubs')
      .select('id')
      .eq('creator_id', userId);

    const clubIds = (userClubs ?? []).map((c: any) => c.id);
    if (clubIds.length > 0) {
      await adminClient.from('club_members').delete().in('club_id', clubIds);
      await adminClient.from('clubs').delete().eq('creator_id', userId);
    }

    // 9. Notify Discord (before profile is deleted so we still have the data)
    try {
      const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/discord-activity-notify`;
      await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          type: 'account_deleted',
          name: profileData?.name ?? 'Unknown',
          email: user.email ?? '—',
          event_count: eventIds.length,
          club_count: clubIds.length,
          attendee_count: totalAttendeeCount,
        }),
      });
    } catch (notifyErr) {
      console.error('Failed to send Discord notification:', notifyErr);
    }

    // 10. Delete profile (cascades remaining references)
    await adminClient.from('profiles').delete().eq('id', userId);

    // 11. Delete the auth user itself
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('delete-account error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
