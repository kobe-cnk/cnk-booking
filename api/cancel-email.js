// Sends a branded booking CANCELLATION email to the customer via Resend.
// POST { booking: {...} }  ->  emails the customer at booking.email
// Requires RESEND_API_KEY, and a verified domain + RESEND_FROM for delivery to customers.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const REPLY_TO = 'photos@cnkbooths.com';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function packageLabel(p) {
  var k = String(p == null ? '' : p).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k === 'hourly' || k.indexOf('hour') !== -1) return '2 Hours';
  if (k.indexOf('half') !== -1) return 'Half Day (4 hours)';
  if (k.indexOf('full') !== -1) return 'Full Day (8 hours)';
  return p ? String(p) : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    const b = (req.body && (req.body.booking || req.body)) || {};
    const to = (b.email || '').trim();
    if (!to || to.indexOf('@') === -1) { res.status(200).json({ ok: false, error: 'No customer email' }); return; }

    const firstName = String(b.name || 'there').trim().split(/\s+/)[0] || 'there';
    const pkg = packageLabel(b.package);
    const detail = [];
    if (b.id) detail.push(['Confirmation #', b.id]);
    if (b.date) detail.push(['Date', b.date]);
    if (pkg) detail.push(['Package', pkg]);
    const rows = detail.map(function (l) {
      return '<tr><td style="padding:5px 16px 5px 0;color:#888;">' + esc(l[0]) + '</td><td style="padding:5px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>';
    }).join('');

    const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">' +
      '<h2 style="color:#7a1f2b;margin-bottom:6px;">Your CNK Booths reservation has been cancelled</h2>' +
      '<p style="color:#333;">Hi ' + esc(firstName) + ',</p>' +
      '<p style="color:#333;">This confirms that your CNK Booths photo booth reservation has been cancelled. Here are the details of the reservation we cancelled:</p>' +
      '<table style="border-collapse:collapse;font-size:14px;margin:8px 0;">' + rows + '</table>' +
      '<p style="color:#333;">If any deposit you paid is eligible for a refund, it will be processed to your original payment method. If you think this was a mistake, or you\'d like to rebook a different date, just reply to this email or reach us at ' + esc(REPLY_TO) + ' and we\'ll take care of you.</p>' +
      '<p style="color:#333;">We\'d still love to be part of your next event!<br/>&mdash; The CNK Booths Team</p>' +
      '</div>';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: 'Your CNK Booths reservation has been cancelled', html: html })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
