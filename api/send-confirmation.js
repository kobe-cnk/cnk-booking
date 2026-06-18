// Manually (re)send the customer CONFIRMATION email for a booking.
// POST { booking: {...} }  ->  sends the confirmation to booking.email
// Used by the "Resend confirmation" button in the admin reservation view,
// in case the customer didn't receive the original.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }
  try {
    const b = (req.body && (req.body.booking || req.body)) || {};
    if (!b || !b.email) { res.status(200).json({ ok: false, error: 'No customer email on this reservation' }); return; }
    const { sendCustomerConfirmation } = require('../lib/confirmation');
    const result = await sendCustomerConfirmation(b);
    res.status(200).json(result);
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
