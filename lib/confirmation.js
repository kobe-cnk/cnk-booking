// Sends a customer-facing booking CONFIRMATION email via Resend.
// Reused by: api/notify-booking.js (auto-send on every new booking)
//        and api/send-confirmation.js (manual "resend" from the admin reservation view).
// Best-effort: callers should not let a failure here block the booking flow.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const REPLY_TO = 'photos@cnkbooths.com';

function money(n) {
  if (n === '' || n === null || n === undefined) return '';
  n = Number(n);
  if (isNaN(n)) return '';
  return '$' + n.toFixed(2);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function packageLabel(p) {
  var k = String(p == null ? '' : p).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k === 'hourly' || k.indexOf('hour') !== -1 || k === '2hours' || k === '2hour') return '2 Hours';
  if (k.indexOf('half') !== -1) return 'Half Day (4 hours)';
  if (k.indexOf('full') !== -1) return 'Full Day (8 hours)';
  return p ? String(p) : '';
}

// booking: the booking object (b.id, b.name, b.email, b.date, b.package, b.location, b.price, b.deposit, b.balance)
// Returns { ok:true, id } on success, or { ok:false, error } on failure. Never throws.
async function sendCustomerConfirmation(booking) {
  try {
    if (!RESEND_KEY) return { ok: false, error: 'Email not configured' };
    var b = booking || {};
    if (!b.email) return { ok: false, error: 'No customer email on booking' };

    var firstName = String(b.name || '').trim().split(/\s+/)[0] || 'there';
    var pkg = packageLabel(b.package);

    var detail = [];
    if (b.id) detail.push(['Confirmation #', b.id]);
    if (b.date) detail.push(['Date', b.date]);
    if (pkg) detail.push(['Package', pkg]);
    if (b.location) detail.push(['Location', b.location]);
    var rows = detail.map(function (l) {
      return '<tr><td style="padding:5px 16px 5px 0;color:#888;">' + esc(l[0]) +
        '</td><td style="padding:5px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>';
    }).join('');

    var total = money(b.price), dep = money(b.deposit), bal = money(b.balance);
    var moneyLine = '';
    var parts = [];
    if (total) parts.push('<strong>Total:</strong> ' + total);
    if (dep) parts.push('<strong>Deposit paid:</strong> ' + dep);
    if (bal) parts.push('<strong>Balance due:</strong> ' + bal);
    if (parts.length) moneyLine = '<p style="font-size:14px;color:#111;margin:14px 0;">' + parts.join(' &nbsp;&middot;&nbsp; ') + '</p>';

    var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">' +
      '<h2 style="color:#7a1f2b;margin-bottom:6px;">Your CNK Booths photo booth is confirmed!</h2>' +
      '<p style="color:#333;">Hi ' + esc(firstName) + ',</p>' +
      '<p style="color:#333;">Thanks for booking with CNK Booths &mdash; your photo booth is confirmed! Here are your details:</p>' +
      '<table style="border-collapse:collapse;font-size:14px;margin:8px 0;">' + rows + '</table>' +
      moneyLine +
      '<p style="color:#333;">We handle delivery, setup, and breakdown &mdash; all you do is show up and smile. ' +
      'Questions or changes? Just reply to this email or reach us at ' + esc(REPLY_TO) + '.</p>' +
      '<p style="color:#333;">We can\'t wait to be part of your event!<br/>&mdash; The CNK Booths Team</p>' +
      '</div>';

    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [b.email],
        reply_to: REPLY_TO,
        subject: 'Your CNK Booths photo booth is confirmed!',
        html: html
      })
    });
    var out = await r.json();
    if (!r.ok) return { ok: false, error: (out && out.message) || ('HTTP ' + r.status) };
    return { ok: true, id: out.id };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

module.exports = { sendCustomerConfirmation: sendCustomerConfirmation, packageLabel: packageLabel };
