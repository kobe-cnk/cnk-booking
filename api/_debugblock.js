// TEMPORARY diagnostic — remove after use.
const { sql } = require('@vercel/postgres');
module.exports = async function handler(req, res) {
  try {
    const date = (req.query && req.query.date) || '2027-12-28';
    await sql`INSERT INTO bookings (id, event_date, status, data) VALUES (${'__BLOCK__'+date}, ${date}, 'blocked', ${JSON.stringify({id:'__BLOCK__'+date,date:date,status:'blocked'})}) ON CONFLICT (id) DO UPDATE SET event_date=EXCLUDED.event_date, status=EXCLUDED.status, data=EXCLUDED.data`;
    const colMatch = await sql`SELECT id, event_date, status FROM bookings WHERE event_date = ${date} AND status = 'blocked'`;
    const allOnDate = await sql`SELECT id, event_date, status FROM bookings WHERE event_date = ${date}`;
    await sql`DELETE FROM bookings WHERE id = ${'__BLOCK__'+date}`;
    res.status(200).json({ date, guardWouldFind: colMatch.length, guardRows: colMatch, allOnDate });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
};
