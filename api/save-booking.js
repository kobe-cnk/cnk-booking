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
    // --- Availability guard ---
    const isSpecial = String(b.id || '').indexOf('__') === 0 || b.status === 'blocked';
    const TOTAL_BOOTHS = parseInt(process.env.TOTAL_BOOTHS || '1', 10);
    if (b && b.date && !isSpecial) {
      // Read the same way list-bookings does (SELECT data) — this path returns fresh rows
      // reliably — then match the date in JS so we don't depend on the event_date column.
      const { rows } = await sql`SELECT data FROM bookings`;
      const sameDate = rows
        .map(function (r) { return r.data || {}; })
        .filter(function (x) { return x && String(x.date || '') === String(b.date) && String(x.id || '') !== String(b.id || ''); });
      // 1) Blocked date (event / trade show)
      if (sameDate.some(function (x) { return String(x.status || '').toLowerCase() === 'blocked' || String(x.id || '').indexOf('__BLOCK__') === 0; })) {
        res.status(409).json({ error: 'date_unavailable', message: 'That date is unavailable. Please choose another date.', blocked: true });
        return;
      }
      // 2) At booth capacity
      const activeOnDate = sameDate.filter(function (x) {
        var s = String(x.status || '').toLowerCase();
        return ['cancelled', 'canceled', 'declined', 'refunded', 'void', 'blocked'].indexOf(s) === -1
          && String(x.id || '').indexOf('__') !== 0;
      });
      if (activeOnDate.length >= TOTAL_BOOTHS) {
        res.status(409).json({ error: 'date_unavailable', message: 'That date is already fully booked. Please choose another date.', booked: activeOnDate.length, booths: TOTAL_BOOTHS });
        return;
      }
    }

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
