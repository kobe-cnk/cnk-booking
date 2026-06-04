// Returns the booking details needed to render the signing page, looked up by the
// unguessable signing token. Only exposes the fields the agreement needs.
// GET /api/get-agreement?token=...
const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  try {
    const token = (req.query && req.query.token) || '';
    if (!token || token.length < 20) { res.status(200).json({ ok:false, error:'Invalid link' }); return; }
    const { rows } = await sql`SELECT data FROM bookings WHERE data->>'signToken' = ${token}`;
    if (!rows.length) { res.status(200).json({ ok:false, error:'Agreement not found — this link may have expired' }); return; }
    let b = rows[0].data; if (typeof b === 'string') b = JSON.parse(b);
    const pw = b.paperwork || {};
    res.status(200).json({ ok:true, booking: {
      id: b.id, name: b.name, email: b.email, date: b.date, eventType: b.eventType,
      venueName: b.venueName || '', location: b.location || '', guests: b.guests,
      package: b.package, basePrice: b.basePrice, tax: b.tax, ccFee: b.ccFee,
      deliveryFee: b.deliveryFee || 0, discount: b.discount || 0,
      price: b.price, deposit: b.deposit, balance: b.balance,
      startTime: pw.startTime || '', endTime: pw.endTime || '',
      signStatus: b.signStatus || 'awaiting',
      signedName: (b.signStatus === 'signed' && pw.signature) ? pw.signature : ''
    }});
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
