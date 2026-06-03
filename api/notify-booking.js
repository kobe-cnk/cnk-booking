// Sends a new-booking notification email via Resend.
// Requires env var RESEND_API_KEY (free key from resend.com).
// POST { booking: {...} }  ->  emails a summary to photos@cnkbooths.com

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = 'photos@cnkbooths.com';
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';

function money(n){ n = Number(n)||0; return '$' + n.toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    const b = (req.body && req.body.booking) || {};
    const isManual = (b.source || '').toLowerCase().indexOf('manual') !== -1;
    const channel = isManual ? 'Back-end (admin) booking' : 'Online booking';
    const lines = [
      ['Reference', b.id], ['Source', b.source || channel], ['Name', b.name],
      ['Email', b.email], ['Phone', b.phone], ['Event date', b.date],
      ['Event type', b.eventType], ['Package', b.package], ['Guests', b.guests],
      ['Location', b.location], ['Total', money(b.price)], ['Collected', money(b.deposit)],
      ['Balance', money(b.balance)]
    ];
    if (b.deliveryFee) lines.push(['Delivery fee', money(b.deliveryFee) + (b.deliveryMiles ? (' (' + b.deliveryMiles + ' mi RT)') : '')]);
    if (b.discount) lines.push(['Discount', '-' + money(b.discount)]);
    if (b.paymentMethod) lines.push(['Payment method', b.paymentMethod]);
    const rows = lines.filter(function(l){ return l[1] !== undefined && l[1] !== null && l[1] !== ''; })
      .map(function(l){ return '<tr><td style="padding:4px 12px 4px 0;color:#888;">' + esc(l[0]) + '</td><td style="padding:4px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>'; }).join('');
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
      + '<h2 style="color:#b8893a;margin-bottom:4px;">New ' + (isManual ? 'Manual' : 'Online') + ' Booking</h2>'
      + '<p style="color:#555;margin-top:0;">A new reservation just came in via ' + esc(channel) + '.</p>'
      + '<table style="border-collapse:collapse;font-size:14px;">' + rows + '</table>'
      + (b.notes ? ('<p style="margin-top:16px;font-size:13px;color:#555;"><strong>Notes:</strong> ' + esc(b.notes) + '</p>') : '')
      + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths booking system</p></div>';
    const subject = 'New booking: ' + (b.name || 'Customer') + ' — ' + (b.date || '') + ' (' + (b.id || '') + ')';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject: subject, html: html })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
