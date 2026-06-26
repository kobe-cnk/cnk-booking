// Sends an FCR damage-flag alert via Resend. Reuses CNK's existing
// RESEND_API_KEY / RESEND_FROM env vars. Called cross-origin from FCR Inspect
// (https://kobe-cnk.github.io/fcr-inspect/), so it sets CORS headers.
// POST { subject, message, unit, customer, when } -> emails FCRutah@gmail.com

const RESEND_KEY = process.env.RESEND_API_KEY;
const RAW_FROM = process.env.RESEND_FROM || 'First Class Rentals <onboarding@resend.dev>';
// reuse the verified sending address, relabel the display name for FCR
const ADDR = (RAW_FROM.match(/<([^>]+)>/) || [null, RAW_FROM])[1];
const FROM = 'First Class Rentals <' + ADDR + '>';
const TO = 'FCRutah@gmail.com';

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    const b = req.body || {};
    const subject = b.subject || ('Damage flagged - ' + (b.unit || 'Unit'));
    const bodyText = String(b.message || '');
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
      + '<h2 style="color:#c0392b;margin-bottom:4px;">Damage flagged</h2>'
      + '<p style="color:#555;margin-top:0;">A rental inspection was flagged for a damage claim in FCR Inspect.</p>'
      + '<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;color:#111;background:#f6f6f6;padding:12px 14px;border-radius:8px;">'
      + esc(bodyText) + '</pre>'
      + '<p style="margin-top:18px;font-size:12px;color:#aaa;">Sent automatically by FCR Inspect</p></div>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: TO, subject: subject, html: html })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
