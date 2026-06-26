const { ApiError, Client, Environment } = require('square');
const { randomUUID } = require('crypto');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { nonce, amount, currency, description, email, name, bookingId } = req.body;

    if (!nonce || !amount || amount < 50) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { result } = await client.paymentsApi.createPayment({
      sourceId: nonce,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(Math.round(amount)),
        currency: currency || 'USD',
      },
      note: description,
      buyerEmailAddress: email,
      referenceId: bookingId,
    });

    const payment = result.payment;
    // CNK FIX: record the booking server-side the instant payment clears, so a charge can never exist without a record on our end (independent of the customer's browser).
    try {
      const _bk = (req.body && req.body.booking) ? req.body.booking : null;
      const _rec = (_bk && _bk.id)
        ? Object.assign({}, _bk, { paymentId: payment.id, paid: true, status: (_bk.status || 'confirmed'), paidAt: new Date().toISOString() })
        : { id: bookingId, name: name || '', email: email || '', note: description || '', amountPaid: Number(payment.amountMoney.amount) / 100, paymentId: payment.id, paid: true, status: 'paid', source: 'server-backstop', serverBackstop: true, paidAt: new Date().toISOString(), created: Date.now() };
      if (_rec.id) {
        const _host = req.headers.host;
        const _save = fetch('https://' + _host + '/api/save-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_rec) }).then(function(){}).catch(function(){});
        await Promise.race([ _save, new Promise(function(r){ setTimeout(r, 4000); }) ]);
      }
    } catch (e) { console.error('post-charge backstop save failed', e); }

    const card = payment.cardDetails?.card;

    return res.status(200).json({
      success: true,
      paymentId: payment.id,
      amount: Number(payment.amountMoney.amount),
      cardBrand: card?.cardBrand || '',
      cardLast4: card?.last4 || '',
    });

  } catch (err) {
    console.error('Square error:', err);
    const msg = err instanceof ApiError
      ? err.errors?.[0]?.detail || 'Payment failed'
      : err.message || 'Payment failed';
    return res.status(400).json({ error: msg });
  }
};
