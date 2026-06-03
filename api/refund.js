// Refunds a Square payment by paymentId. Used when an admin cancels a booking
// that was paid via card (online deposit or Collect Balance).
// POST { paymentId, amount (optional cents; omit to refund full), reason }
const { Client, Environment } = require('square');
const crypto = require('crypto');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { paymentId, amount, reason } = req.body || {};
    if (!paymentId) { res.status(400).json({ ok:false, error: 'Missing paymentId' }); return; }
    // Look up the payment to know how much can be refunded and the currency.
    let payAmount = null, currency = 'USD';
    try {
      const pr = await client.paymentsApi.getPayment(paymentId);
      const p = pr.result && pr.result.payment;
      if (p && p.amountMoney) { payAmount = Number(p.amountMoney.amount); currency = p.amountMoney.currency || 'USD'; }
    } catch (e) { /* fall through; will try requested amount */ }
    let refundCents = (amount != null) ? Math.round(Number(amount)) : payAmount;
    if (!refundCents || refundCents < 1) { res.status(400).json({ ok:false, error: 'Could not determine refund amount' }); return; }
    if (payAmount != null && refundCents > payAmount) refundCents = payAmount;
    const resp = await client.refundsApi.refundPayment({
      idempotencyKey: crypto.randomUUID(),
      paymentId: paymentId,
      amountMoney: { amount: BigInt(refundCents), currency: currency },
      reason: reason || 'Booking cancelled'
    });
    const refund = resp.result && resp.result.refund;
    res.status(200).json({ ok:true, refundId: refund && refund.id, status: refund && refund.status, amount: refundCents });
  } catch (e) {
    const msg = (e && e.errors && e.errors[0] && e.errors[0].detail) || (e && e.message) || String(e);
    res.status(200).json({ ok:false, error: msg });
  }
};
