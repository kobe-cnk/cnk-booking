const { sql } = require('@vercel/postgres');

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      event_date TEXT,
      package TEXT,
      base_price NUMERIC,
      tax NUMERIC,
      cc_fee NUMERIC,
      price NUMERIC,
      deposit NUMERIC,
      balance NUMERIC,
      status TEXT,
      event_type TEXT,
      location TEXT,
      guests TEXT,
      notes TEXT,
      source TEXT,
      created BIGINT,
      data JSONB
    )
  `;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureTable();
    const b = req.body || {};
    if (!b.id) { res.status(400).json({ error: 'Missing booking id' }); return; }
    await sql`
      INSERT INTO bookings (id, name, email, phone, event_date, package, base_price, tax, cc_fee, price, deposit, balance, status, event_type, location, guests, notes, source, created, data)
      VALUES (${b.id}, ${b.name||''}, ${b.email||''}, ${b.phone||''}, ${b.date||''}, ${b.package||''}, ${b.basePrice||0}, ${b.tax||0}, ${b.ccFee||0}, ${b.price||0}, ${b.deposit||0}, ${b.balance||0}, ${b.status||'confirmed'}, ${b.eventType||''}, ${b.location||''}, ${b.guests||''}, ${b.notes||''}, ${b.source||''}, ${b.created||Date.now()}, ${JSON.stringify(b)})
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, event_date=EXCLUDED.event_date,
        package=EXCLUDED.package, base_price=EXCLUDED.base_price, tax=EXCLUDED.tax, cc_fee=EXCLUDED.cc_fee,
        price=EXCLUDED.price, deposit=EXCLUDED.deposit, balance=EXCLUDED.balance, status=EXCLUDED.status,
        event_type=EXCLUDED.event_type, location=EXCLUDED.location, guests=EXCLUDED.guests,
        notes=EXCLUDED.notes, source=EXCLUDED.source, data=EXCLUDED.data
    `;
    res.status(200).json({ ok: true, id: b.id });
  } catch (e) {
    res.status(500).json({ error: 'Save failed', detail: String(e && e.message || e) });
  }
};
