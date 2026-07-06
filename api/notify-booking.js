// Sends notification emails via Resend.
//   - New booking summary -> photos@cnkbooths.com   payload: { booking: {...} }
//   - FCR damage flag      -> FCRutah@gmail.com       payload: { email, subject, message, unit, ... }
// Requires env var RESEND_API_KEY (free key from resend.com).

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = 'photos@cnkbooths.com';
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';

function money(n){ n = Number(n)||0; return '$' + n.toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  // CORS so the FCR Inspect PWA (github.io, cross-origin) can reach the damage path
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // ---- FCR Inspect damage alert (no booking object; carries a message/unit) ----
  if (!body.booking && (body.message || body.unit)) {
    try {
      const to = body.email || 'FCRutah@gmail.com';
      const subject = body.subject || ('Damage flagged - ' + (body.unit || 'unit'));
      const msg = body.message || '';
      const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
        + '<h2 style="color:#c0392b;margin-bottom:4px;">\u2691 Damage flagged</h2>'
        + '<p style="color:#555;margin-top:0;">A unit was flagged for damage during an FCR inspection.</p>'
        + '<pre style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap;line-height:1.5;margin:0;">'
        + esc(msg) + '</pre>'
        + '<p style="margin-top:20px;font-size:12px;color:#aaa;">FCR Inspect</p></div>';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: body._replyto || to, subject: subject, html: html, text: msg })
      });
      const out = await r.json();
      res.status(200).json(r.ok ? { ok: true, id: out.id } : { ok: false, error: (out && out.message) || ('HTTP ' + r.status) });
    } catch (e) {
      res.status(200).json({ ok: false, error: String(e && e.message || e) });
    }
    return;
  }

  // ---- new-booking notification (original behavior) ----
  try {
    const b = body.booking || {};
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
    const subject = 'New booking: ' + (b.name || 'Customer') + ' - ' + (b.date || '') + ' (' + (b.id || '') + ')';
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
