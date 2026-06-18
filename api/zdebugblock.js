// TEMPORARY diagnostic — remove after use.
const { sql } = require('@vercel/postgres');
module.exports = async function handler(req, res) {
  try {
    const date = (req.query && req.query.date) || '2027-10-10';
    const bid = '__BLOCK__' + date;
    // Insert a block the SAME way save-booking does (full insert), via a normal booking shape
    await sql`INSERT INTO bookings (id, name, email, phone, event_date, package, base_price, tax, cc_fee, price, deposit, balance, status, event_type, location, guests, notes, source, created, data)
      VALUES (${bid}, 'TEST', '', '', ${date}, '', 0,0,0,0,0,0, 'blocked', '', '', '', '', 'blocked', ${Date.now()}, ${JSON.stringify({id:bid,date:date,status:'blocked'})})
      ON CONFLICT (id) DO UPDATE SET event_date=EXCLUDED.event_date, status=EXCLUDED.status, data=EXCLUDED.data`;
    const byCol = await sql`SELECT id, event_date, status FROM bookings WHERE event_date = ${date} AND status = 'blocked'`;
    const raw = await sql`SELECT id, event_date, status FROM bookings WHERE id = ${bid}`;
    await sql`DELETE FROM bookings WHERE id = ${bid}`;
    res.status(200).json({ date, guardWouldFind: byCol.length, rawRow: raw[0] || null });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
};
