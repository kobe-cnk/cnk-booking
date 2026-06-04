// Records the client's signature on their rental agreement.
// POST { token, name, signatureImg } -> { ok }
// signatureImg is a PNG data URL drawn on the signing page's signature pad.
const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { token, name, signatureImg } = req.body || {};
    if (!token || String(token).length < 20) { res.status(200).json({ ok:false, error:'Invalid link' }); return; }
    const cleanName = String(name||'').trim();
    if (!cleanName) { res.status(200).json({ ok:false, error:'Please type your full name' }); return; }
    const img = String(signatureImg||'');
    if (img.indexOf('data:image/') !== 0 || img.length < 200) { res.status(200).json({ ok:false, error:'Please sign in the signature box' }); return; }
    if (img.length > 200000) { res.status(200).json({ ok:false, error:'Signature image too large — please clear and sign again' }); return; }

    const { rows } = await sql`SELECT data FROM bookings WHERE data->>'signToken' = ${token}`;
    if (!rows.length) { res.status(200).json({ ok:false, error:'Agreement not found — this link may have expired' }); return; }
    let b = rows[0].data; if (typeof b === 'string') b = JSON.parse(b);
    if (b.signStatus === 'signed') { res.status(200).json({ ok:true, already:true }); return; }

    b.paperwork = b.paperwork || {};
    b.paperwork.signature = cleanName;
    b.paperwork.agreedAt = new Date().toISOString();
    b.paperwork.mediaRelease = !!(req.body && req.body.mediaRelease);
    b.signatureImg = img;
    b.signStatus = 'signed';
    await sql`UPDATE bookings SET data = ${JSON.stringify(b)}::jsonb WHERE id = ${b.id}`;
    try {
      if (process.env.RESEND_API_KEY) {
        const adminTo = process.env.CNK_ADMIN_EMAIL || 'frmnkb@gmail.com';
        const money = (x) => '$' + (Number(x)||0).toFixed(2);
        const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
          + '<h2 style="color:#b8893a;">Rental Agreement Signed</h2>'
          + '<p><strong>' + cleanName + '</strong> has signed their CNK Booths rental agreement.</p>'
          + '<table style="font-size:14px;border-collapse:collapse;">'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Reference</td><td>' + (b.id||'') + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Client</td><td>' + (b.name||'') + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Event date</td><td>' + (b.date||'') + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Package</td><td>' + (b.package||'') + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Total</td><td>' + money(b.price) + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Balance due</td><td>' + money(b.balance) + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Media release</td><td>' + (b.paperwork.mediaRelease ? 'Yes' : 'No') + '</td></tr>'
          + '<tr><td style="color:#888;padding:2px 12px 2px 0;">Signed at</td><td>' + b.paperwork.agreedAt + '</td></tr>'
          + '</table>'
          + '<p style="font-size:13px;color:#555;">The signature image is attached and is saved on the booking record.</p></div>';
        const payload = { from: process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>', to: [adminTo], reply_to: 'photos@cnkbooths.com', subject: 'Signed agreement - ' + (b.name||'') + ' (' + (b.date||'') + ')', html: html };
        const ci = img.indexOf('base64,');
        if (ci !== -1) { payload.attachments = [{ filename: 'signature-' + (b.id||'') + '.png', content: img.slice(ci + 7) }]; }
        await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }
    } catch (eMail) { }
    res.status(200).json({ ok:true });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
