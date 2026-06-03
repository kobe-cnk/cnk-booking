const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  try {
    // Ensure table exists so a fresh DB doesn't error on first read
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, event_date TEXT, package TEXT,
        base_price NUMERIC, tax NUMERIC, cc_fee NUMERIC, price NUMERIC, deposit NUMERIC, balance NUMERIC,
        status TEXT, event_type TEXT, location TEXT, guests TEXT, notes TEXT, source TEXT, created BIGINT, data JSONB
      )
    `;
    const { rows } = await sql`SELECT data FROM bookings ORDER BY created DESC`;
    const bookings = rows.map(function(r){ return r.data; });
    res.status(200).json({ ok: true, bookings: bookings });
  } catch (e) {
    res.status(500).json({ error: 'List failed', detail: String(e && e.message || e) });
  }
};
