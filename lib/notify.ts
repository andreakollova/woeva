import { supabase } from './supabase';
import { emailTemplates } from './emailTemplates';

// ─── Core senders ─────────────────────────────────────────────────────────────

async function sendEmail(to: string | string[], subject: string, html: string) {
  try {
    await supabase.functions.invoke('send-email', { body: { to, subject, html } });
  } catch (e) {
    console.warn('sendEmail failed:', e);
  }
}

async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, any>) {
  const valid = tokens.filter(Boolean);
  if (!valid.length) return;
  try {
    await supabase.functions.invoke('send-push', { body: { tokens: valid, title, body, data } });
  } catch (e) {
    console.warn('sendPush failed:', e);
  }
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function getProfile(userId: string): Promise<{ email: string | null; push_token: string | null; name: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('name, push_token, email')
    .eq('id', userId)
    .single();
  return data ? { name: data.name ?? '', push_token: data.push_token ?? null, email: data.email ?? null } : null;
}

async function getProfilesForUsers(userIds: string[]): Promise<{ id: string; name: string; push_token: string | null }[]> {
  if (!userIds.length) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, name, push_token')
    .in('id', userIds);
  return (data ?? []) as any[];
}

async function getEventAttendeeTokens(eventId: string, excludeUserId?: string): Promise<string[]> {
  const { data } = await supabase
    .from('event_attendees')
    .select('user_id, profile:profiles(push_token)')
    .eq('event_id', eventId);

  return ((data ?? []) as any[])
    .filter(a => a.user_id !== excludeUserId && a.profile?.push_token)
    .map(a => a.profile.push_token);
}

// ─── Notification functions ────────────────────────────────────────────────────

export const notify = {

  /** User joined an event — notify creator */
  async joinedEvent(params: {
    creatorId: string;
    attendeeName: string;
    eventTitle: string;
    eventDate: string;
    eventTime?: string;
    eventId: string;
  }) {
    const creator = await getProfile(params.creatorId);
    await Promise.all([
      creator?.push_token && sendPush([creator.push_token], `New attendee for ${params.eventTitle}`, `${params.attendeeName} joined your event.`, { event_id: params.eventId }),
      creator?.email && sendEmail(creator.email, `New attendee — ${params.eventTitle}`,
        emailTemplates.joinedEvent({ attendeeName: params.attendeeName, eventTitle: params.eventTitle, eventDate: params.eventDate, eventTime: params.eventTime })
      ),
    ]);
  },

  /** User left an event — notify creator */
  async leftEvent(params: {
    creatorId: string;
    creatorEmail: string;
    attendeeName: string;
    eventTitle: string;
    eventId: string;
  }) {
    const creator = await getProfile(params.creatorId);
    await Promise.all([
      creator?.push_token && sendPush([creator.push_token], `${params.attendeeName} cancelled`, `They left ${params.eventTitle}.`, { event_id: params.eventId }),
      creator?.email && sendEmail(creator.email, `Attendee cancelled — ${params.eventTitle}`,
        emailTemplates.leftEvent({ attendeeName: params.attendeeName, eventTitle: params.eventTitle })
      ),
    ]);
  },

  /** Event cancelled — notify all attendees */
  async eventCancelled(params: {
    eventId: string;
    eventTitle: string;
    creatorName: string;
    reason?: string;
    attendeeEmails: string[];
    attendeeTokens: string[];
  }) {
    await Promise.all([
      params.attendeeTokens.length && sendPush(
        params.attendeeTokens,
        `${params.eventTitle} was cancelled`,
        `Sorry — ${params.creatorName} had to cancel this event.`,
        { event_id: params.eventId }
      ),
      params.attendeeEmails.length && sendEmail(
        params.attendeeEmails,
        `Cancelled: ${params.eventTitle}`,
        emailTemplates.eventCancelled({ eventTitle: params.eventTitle, creatorName: params.creatorName, reason: params.reason })
      ),
    ]);
  },

  /** New club event — notify club members */
  async newClubEvent(params: {
    clubName: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime?: string;
    venue?: string;
    memberTokens: string[];
    memberEmails: string[];
  }) {
    await Promise.all([
      params.memberTokens.length && sendPush(
        params.memberTokens,
        `New event in ${params.clubName}`,
        params.eventTitle,
        { event_id: params.eventId }
      ),
      params.memberEmails.length && sendEmail(
        params.memberEmails,
        `New event in ${params.clubName}: ${params.eventTitle}`,
        emailTemplates.newClubEvent({ clubName: params.clubName, eventTitle: params.eventTitle, eventDate: params.eventDate, eventTime: params.eventTime, venue: params.venue })
      ),
    ]);
  },

  /** Admin invite */
  async adminInvite(params: {
    inviteeId: string;
    inviteeName: string;
    inviterName: string;
    clubName: string;
    clubId: string;
  }) {
    const invitee = await getProfile(params.inviteeId);

    await Promise.all([
      invitee?.push_token && sendPush([invitee.push_token], `Admin invite: ${params.clubName}`, `${params.inviterName} invited you to co-manage ${params.clubName}.`, { club_id: params.clubId }),
      invitee?.email && sendEmail(invitee.email, `You're invited to manage ${params.clubName}`,
        emailTemplates.adminInvite({ inviterName: params.inviterName, clubName: params.clubName })
      ),
    ]);
  },

  /** Club deleted — notify affected members/attendees */
  async clubDeleted(params: {
    clubName: string;
    affectedUsers: { email: string | null; push_token: string | null; eventTitle?: string }[];
  }) {
    const tokens = params.affectedUsers.map(u => u.push_token).filter(Boolean) as string[];
    const emails = params.affectedUsers.filter(u => u.email).map(u => u.email) as string[];

    await Promise.all([
      tokens.length && sendPush(tokens, `${params.clubName} was deleted`, 'The club and all its events have been removed.'),
      ...params.affectedUsers.filter(u => u.email).map(u =>
        sendEmail(u.email!, `Club deleted: ${params.clubName}`,
          emailTemplates.clubDeleted({ clubName: params.clubName, eventTitle: u.eventTitle })
        )
      ),
    ]);
  },

  /** Welcome email on signup */
  async welcome(params: { email: string; name: string }) {
    await sendEmail(params.email, 'Welcome to Woeva!', emailTemplates.welcome({ name: params.name }));
  },

  /**
   * New chat message — sends push only on the first message after 1h of room idle.
   * Checks the second-most-recent message in the room; if it's older than 1h (or absent),
   * notifies all event attendees except the sender.
   */
  async chatMessage(params: {
    roomId: string;
    eventId: string;
    senderName: string;
    eventTitle: string;
    senderId: string;
  }) {
    // Find the previous message in this room to determine idle time
    const { data: prev } = await supabase
      .from('messages')
      .select('created_at')
      .eq('room_id', params.roomId)
      .order('created_at', { ascending: false })
      .limit(2);

    // prev[0] = current message, prev[1] = one before it (if any)
    const lastOtherMsg = prev && prev.length >= 2 ? prev[1] : null;
    const isIdle = !lastOtherMsg || (Date.now() - new Date((lastOtherMsg as any).created_at).getTime() > 60 * 60 * 1000);

    if (!isIdle) return;

    const tokens = await getEventAttendeeTokens(params.eventId, params.senderId);
    if (!tokens.length) return;

    await sendPush(
      tokens,
      params.eventTitle,
      `${params.senderName}: new message in chat`,
      { room_id: params.roomId, event_id: params.eventId, type: 'event_chat' }
    );
  },
};
