const BASE = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
    <div style="background:#000;padding:24px 32px;">
      <span style="font-size:22px;font-weight:900;color:#C6F135;letter-spacing:-1px;">WOEVA</span>
    </div>
    <div style="padding:32px;">
      {{CONTENT}}
    </div>
    <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
      Woeva · You received this because you have an account on woeva.app
    </div>
  </div>
`;

function wrap(content: string) {
  return BASE.replace('{{CONTENT}}', content);
}

export const emailTemplates = {
  joinedEvent: (params: { attendeeName: string; eventTitle: string; eventDate: string; eventTime?: string; eventUrl?: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">New attendee 🎉</h2>
      <p style="color:#555;margin:0 0 20px;"><strong>${params.attendeeName}</strong> just signed up for <strong>${params.eventTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;background:#f8f8f8;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:12px 16px;font-size:13px;color:#666;">Event</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#000;">${params.eventTitle}</td></tr>
        <tr><td style="padding:12px 16px;font-size:13px;color:#666;border-top:1px solid #eee;">Date</td><td style="padding:12px 16px;font-size:13px;color:#000;border-top:1px solid #eee;">${params.eventDate}${params.eventTime ? ' · ' + params.eventTime : ''}</td></tr>
      </table>
    `),

  leftEvent: (params: { attendeeName: string; eventTitle: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">Attendee cancelled</h2>
      <p style="color:#555;margin:0;"><strong>${params.attendeeName}</strong> cancelled their spot at <strong>${params.eventTitle}</strong>.</p>
    `),

  eventCancelled: (params: { eventTitle: string; reason?: string; creatorName: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">Event cancelled</h2>
      <p style="color:#555;margin:0 0 16px;"><strong>${params.eventTitle}</strong> has been cancelled by the organiser <strong>${params.creatorName}</strong>.</p>
      ${params.reason ? `<p style="color:#555;margin:0;">Reason: <em>${params.reason}</em></p>` : ''}
      <p style="color:#555;margin:16px 0 0;">If you paid for this event, you will receive a refund within 5–10 business days.</p>
    `),

  newClubEvent: (params: { clubName: string; eventTitle: string; eventDate: string; eventTime?: string; venue?: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">New event in ${params.clubName} 🚀</h2>
      <p style="color:#555;margin:0 0 20px;">A new event was just posted in your club.</p>
      <table style="width:100%;border-collapse:collapse;background:#f8f8f8;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:12px 16px;font-size:13px;color:#666;">Event</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#000;">${params.eventTitle}</td></tr>
        <tr><td style="padding:12px 16px;font-size:13px;color:#666;border-top:1px solid #eee;">Date</td><td style="padding:12px 16px;font-size:13px;color:#000;border-top:1px solid #eee;">${params.eventDate}${params.eventTime ? ' · ' + params.eventTime : ''}</td></tr>
        ${params.venue ? `<tr><td style="padding:12px 16px;font-size:13px;color:#666;border-top:1px solid #eee;">Venue</td><td style="padding:12px 16px;font-size:13px;color:#000;border-top:1px solid #eee;">${params.venue}</td></tr>` : ''}
      </table>
    `),

  adminInvite: (params: { inviterName: string; clubName: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">You've been invited as admin</h2>
      <p style="color:#555;margin:0 0 16px;"><strong>${params.inviterName}</strong> invited you to co-manage <strong>${params.clubName}</strong> on Woeva.</p>
      <p style="color:#555;margin:0;">Open the Woeva app and check your notifications to accept or decline.</p>
    `),

  clubDeleted: (params: { clubName: string; eventTitle?: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">Club deleted</h2>
      <p style="color:#555;margin:0 0 16px;"><strong>${params.clubName}</strong> has been deleted by its owner.</p>
      ${params.eventTitle ? `<p style="color:#555;margin:0;">Your registration for <strong>${params.eventTitle}</strong> has been cancelled. If you paid, a refund is on its way.</p>` : ''}
    `),

  welcome: (params: { name: string }) =>
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#000;">Welcome to Woeva, ${params.name} 👋</h2>
      <p style="color:#555;margin:0 0 16px;">You're all set. Discover events near you, join clubs, and create your own experiences.</p>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://woeva.app" style="display:inline-block;background:#C6F135;color:#000;font-weight:700;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px;">Explore events</a>
      </div>
    `),
};
