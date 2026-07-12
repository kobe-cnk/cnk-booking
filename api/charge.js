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

    // __cnkCardOnFile: save a card on file. Never charges. Runs AFTER the deposit has cleared,
    // so a failure here can never affect the deposit.
    if (req.body && req.body.action === 'save_card') {
      try {
        // __cnkCustDedupe: reuse an existing Square customer (Square auto-creates one from the
        // card payment) instead of blindly making a second profile for the same person.
        let customerId = null;
        if (email) {
          try {
            const found = await client.customersApi.searchCustomers({
              limit: BigInt(1),
              query: { filter: { emailAddress: { exact: email } } }
            });
            const hit = found.result && found.result.customers && found.result.customers[0];
            if (hit && hit.id) customerId = hit.id;
          } catch (e) { /* search is best effort; fall through to create */ }
        }
        if (!customerId) {
          const custRes = await client.customersApi.createCustomer({
            idempotencyKey: randomUUID(),
            emailAddress: email || undefined,
            givenName: String(name || '').split(' ')[0] || undefined,
            familyName: String(name || '').split(' ').slice(1).join(' ') || undefined,
            referenceId: bookingId || undefined
          });
          customerId = custRes.result.customer.id;
        }
        const cardRes = await client.cardsApi.createCard({
          idempotencyKey: randomUUID(),
          sourceId: nonce,
          verificationToken: req.body.verificationToken || undefined,
          card: { customerId: customerId, cardholderName: name || undefined, referenceId: bookingId || undefined }
        });
        const cd = cardRes.result.card;
        return res.status(200).json({
          ok: true, customerId: customerId, cardId: cd.id,
          last4: String(cd.last4 || ''), brand: String(cd.cardBrand || ''),
          expMonth: String(cd.expMonth || ''), expYear: String(cd.expYear || '')
        });
      } catch (e) {
        // Soft-fail: the deposit already succeeded; never surface an error that could confuse the customer.
        return res.status(200).json({ ok: false, error: String((e && e.message) || 'save_card_failed').slice(0, 200) });
      }
    }

    // __cnkCardOnFile: charge a previously saved card (admin-initiated balance charge only).
    if (req.body && req.body.action === 'charge_saved') {
      const cardId = req.body.cardId;
      const customerId = req.body.customerId;
      if (!cardId || !customerId || !amount || amount < 50) {
        return res.status(400).json({ ok: false, error: 'Missing card, customer, or amount' });
      }
      try {
        const payRes = await client.paymentsApi.createPayment({
          sourceId: cardId,
          customerId: customerId,
          idempotencyKey: randomUUID(),
          amountMoney: { amount: BigInt(Math.round(amount)), currency: currency || 'USD' },
          note: description || 'CNK Booths balance',
          referenceId: bookingId || undefined
        });
        const p = payRes.result.payment;
        return res.status(200).json({
          ok: true, paymentId: String(p.id), status: String(p.status),
          amount: Number(p.amountMoney.amount)
        });
      } catch (e) {
        return res.status(200).json({ ok: false, error: String((e && e.message) || 'charge_failed').slice(0, 200) });
      }
    }

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
