// Emails the client a link to review + sign their rental agreement (admin-taken bookings).
// POST { id } -> { ok, link, emailed }
// Generates a one-off unguessable signing token, stores it on the booking, then emails
// the client. Until the cnkbooths.com domain is verified in Resend, the email to outside
// addresses will fail — so the response always includes the link for manual sharing.
const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const SITE = process.env.SITE_URL || 'https://cnk-booking-cc9e.vercel.app';

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const id = (req.body && req.body.id) || '';
    if (!id) { res.status(400).json({ ok:false, error:'Missing booking id' }); return; }
    const { rows } = await sql`SELECT data FROM bookings WHERE id = ${id}`;
    if (!rows.length) { res.status(200).json({ ok:false, error:'Booking not found' }); return; }
    let b = rows[0].data; if (typeof b === 'string') b = JSON.parse(b);

    if (!b.signToken) b.signToken = crypto.randomBytes(24).toString('hex');
    if (b.signStatus !== 'signed') b.signStatus = 'awaiting';
    b.agreementSentAt = new Date().toISOString();
    await sql`UPDATE bookings SET data = ${JSON.stringify(b)}::jsonb WHERE id = ${id}`;

    const link = SITE + '/?sign=' + b.signToken;
    let emailed = false, emailError = null;
    const to = (b.email||'').trim();
    if (RESEND_KEY && to && to.indexOf('@') !== -1) {
      try {
        const first = (b.name||'there').split(' ')[0];
        const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
          + '<h2 style="color:#b8893a;">Please Sign Your CNK Booths Rental Agreement</h2>'
          + '<p style="color:#444;">Hi ' + esc(first) + ', thanks for booking with CNK Booths! Your photo booth rental on <strong>' + esc(b.date||'') + '</strong> is reserved. Please review and sign your rental agreement at the link below:</p>'
          + '<p style="margin:20px 0;"><a href="' + link + '" style="background:#b8893a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Review &amp; Sign Agreement</a></p>'
          + '<p style="font-size:13px;color:#555;">Or copy this link into your browser:<br>' + link + '</p>'
          + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths — Photo Booth Rentals, Utah · Questions? Reply to this email.</p></div>';
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [to], reply_to: 'photos@cnkbooths.com', subject: 'Please sign your CNK Booths rental agreement (' + (b.id||'') + ')', html: html })
        });
        const out = await r.json();
        if (r.ok) emailed = true; else emailError = (out && out.message) || ('HTTP ' + r.status);
      } catch (e) { emailError = String(e && e.message || e); }
    }
    res.status(200).json({ ok:true, link, emailed, emailError: emailError || undefined });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
