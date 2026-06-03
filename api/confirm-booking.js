// Sends a booking CONFIRMATION email to the customer via Resend.
// Requires env var RESEND_API_KEY. To send to outside (customer) addresses,
// the cnkbooths.com domain must be verified in Resend; otherwise Resend only
// allows sending to the account owner's address.
// POST { booking: {...} } -> emails the customer at booking.email

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const REPLY_TO = 'photos@cnkbooths.com';

function money(n){ n = Number(n)||0; return '$' + n.toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    const b = (req.body && req.body.booking) || {};
    const to = (b.email || '').trim();
    if (!to || to.indexOf('@') === -1) { res.status(200).json({ ok: false, error: 'No customer email' }); return; }
    const rows = [
      ['Reference', b.id], ['Event date', b.date], ['Package', b.package],
      ['Event type', b.eventType], ['Location', b.location],
      ['Total', money(b.price)], ['Paid', money(b.deposit)], ['Balance due', money(b.balance)]
    ].filter(function(l){ return l[1] !== undefined && l[1] !== null && l[1] !== ''; })
      .map(function(l){ return '<tr><td style="padding:4px 12px 4px 0;color:#888;">' + esc(l[0]) + '</td><td style="padding:4px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>'; }).join('');
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
      + '<h2 style="color:#b8893a;">Your CNK Booths Booking is Confirmed</h2>'
      + '<p style="color:#444;">Hi ' + esc((b.name||'there').split(' ')[0]) + ', thank you for booking with CNK Booths! Here are your details:</p>'
      + '<table style="border-collapse:collapse;font-size:14px;">' + rows + '</table>'
      + (Number(b.balance)>0 ? ('<p style="margin-top:16px;font-size:13px;color:#555;">Your remaining balance of ' + money(b.balance) + ' will be collected before your event.</p>') : '')
      + '<p style="margin-top:16px;font-size:13px;color:#555;">Questions? Just reply to this email or contact us at photos@cnkbooths.com.</p>'
      + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths — Photo Booth Rentals, Utah</p></div>';
    const subject = 'Your CNK Booths booking is confirmed (' + (b.id||'') + ')';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: subject, html: html })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
