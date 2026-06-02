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
