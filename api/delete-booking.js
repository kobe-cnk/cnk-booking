const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const id = (req.body && req.body.id) || null;
    if (!id) { res.status(400).json({ error: 'Missing booking id' }); return; }
    await sql`DELETE FROM bookings WHERE id = ${id}`;
    res.status(200).json({ ok: true, deleted: id });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed', detail: String(e && e.message || e) });
  }
};
