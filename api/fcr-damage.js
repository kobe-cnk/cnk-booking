// Sends a damage-flag alert email via Resend when FCR Inspect flags a unit.
// Reuses the same RESEND_API_KEY as the booking notifications.
// POST { email, subject, message, unit, customer, when } -> emails the FCR office.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const FALLBACK_TO = 'FCRutah@gmail.com';

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  // Allow the GitHub Pages PWA (different origin) to POST here.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b || {};
    const to = b.email || FALLBACK_TO;
    const subject = b.subject || ('Damage flagged - ' + (b.unit || 'unit'));
    const message = b.message || '';
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
      + '<h2 style="color:#c0392b;margin-bottom:4px;">\u2691 Damage flagged</h2>'
      + '<p style="color:#555;margin-top:0;">A unit was flagged for damage during an FCR inspection.</p>'
      + '<pre style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap;line-height:1.5;margin:0;">'
      + esc(message) + '</pre>'
      + '<p style="margin-top:20px;font-size:12px;color:#aaa;">FCR Inspect</p></div>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: b._replyto || to, subject: subject, html: html, text: message })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
