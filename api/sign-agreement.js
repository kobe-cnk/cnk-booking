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
    res.status(200).json({ ok:true });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
