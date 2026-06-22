// Sends a booking CONFIRMATION email to the customer via Resend.
// Requires env var RESEND_API_KEY. To send to outside (customer) addresses,
// the cnkbooths.com domain must be verified in Resend; otherwise Resend only
// allows sending to the account owner's address.
// POST { booking: {...} } -> emails the customer at booking.email

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';
const REPLY_TO = 'photos@cnkbooths.com';

function money(n){ n = Number(n)||0; return '$' + n.toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!RESEND_KEY) { res.status(200).json({ ok: false, error: 'Email not configured' }); return; }
  try {
    const b = (req.body && req.body.booking) || {};
    const type = (req.body && req.body.type) || 'confirm';

    // ----- PARTNERSHIP agreement signed: email BOTH the partner and CNK -----
    if (type === 'partnership') {
      const p = (req.body && req.body.partnership) || {};
      const partnerEmail = (p.email || '').trim();
      const intro = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">'
        + '<p style="color:#444;font-size:14px;">A CNK Booths LLC Venue Partnership Agreement was reviewed and signed electronically by <strong>' + esc(p.signerName || '') + '</strong>'
        + (p.venueName ? (' on behalf of <strong>' + esc(p.venueName) + '</strong>') : '') + '.'
        + (p.agreedAt ? (' Signed at ' + esc(new Date(p.agreedAt).toLocaleString()) + '.') : '')
        + ' The complete signed agreement is reproduced below for both parties\u2019 records.</p>'
        + '<hr style="border:none;border-top:1px solid #ddd;margin:18px 0;">';
      const body = (p.agreementHtml && String(p.agreementHtml).length > 50)
        ? p.agreementHtml
        : ('<p style="color:#444;">Venue: ' + esc(p.venueName||'') + ' &middot; Signer: ' + esc(p.signerName||'') + ' &middot; Email: ' + esc(p.email||'') + ' &middot; Phone: ' + esc(p.phone||'') + ' &middot; Date: ' + esc(p.signDate||'') + '</p>');
      const footer = '<hr style="border:none;border-top:1px solid #ddd;margin:18px 0;">'
        + '<p style="font-size:12px;color:#888;">This copy was generated automatically when the agreement was signed at cnkbooths.com. Questions? Contact photos@cnkbooths.com.</p>'
        + '<p style="margin-top:8px;font-size:12px;color:#aaa;">CNK Booths LLC \u2014 Photo Booth Partnerships, Utah</p></div>';
      const html = intro + body + footer;
      const recipients = ['photos@cnkbooths.com'];
      if (partnerEmail && partnerEmail.indexOf('@') !== -1) recipients.push(partnerEmail);
      const pr = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: recipients, reply_to: REPLY_TO, subject: 'Signed Venue Partnership Agreement \u2014 ' + (p.venueName || 'CNK Booths'), html: html })
      });
      const pout = await pr.json();
      if (!pr.ok) { res.status(200).json({ ok: false, error: (pout && pout.message) || ('HTTP ' + pr.status) }); return; }
      res.status(200).json({ ok: true, id: pout.id, type: 'partnership' });
      return;
    }

    const to = (b.email || '').trim();
    if (!to || to.indexOf('@') === -1) { res.status(200).json({ ok: false, error: 'No customer email' }); return; }

    // ----- CANCELLATION email -----
    if (type === 'cancel') {
      const crows = [
        ['Reference', b.id], ['Event date', b.date], ['Package', b.package], ['Location', b.location]
      ].filter(function(l){ return l[1] !== undefined && l[1] !== null && l[1] !== ''; })
        .map(function(l){ return '<tr><td style="padding:4px 12px 4px 0;color:#888;">' + esc(l[0]) + '</td><td style="padding:4px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>'; }).join('');
      const chtml = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
        + '<h2 style="color:#7a1f2b;">Your CNK Booths reservation has been cancelled</h2>'
        + '<p style="color:#444;">Hi ' + esc((b.name||'there').split(' ')[0]) + ', this confirms your CNK Booths photo booth reservation has been cancelled. Here are the details:</p>'
        + '<table style="border-collapse:collapse;font-size:14px;">' + crows + '</table>'
        + '<p style="margin-top:16px;font-size:13px;color:#555;">If any deposit you paid is eligible for a refund, it will be returned to your original payment method. If this was a mistake or you\'d like to rebook a different date, just reply to this email or contact us at photos@cnkbooths.com.</p>'
        + '<p style="margin-top:16px;font-size:13px;color:#555;">We\'d still love to be part of your next event!</p>'
        + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths — Photo Booth Rentals, Utah</p></div>';
      const cr = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: 'Your CNK Booths reservation has been cancelled', html: chtml })
      });
      const cout = await cr.json();
      if (!cr.ok) { res.status(200).json({ ok: false, error: (cout && cout.message) || ('HTTP ' + cr.status) }); return; }
      res.status(200).json({ ok: true, id: cout.id, type: 'cancel' });
      return;
    }

    // ----- CONFIRMATION email (default) -----
    const rows = [
      ['Reference', b.id], ['Event date', b.date], ['Package', b.package],
      ['Event type', b.eventType], ['Location', b.location],
      ['Total', money(b.price)], ['Paid', money(b.deposit)], ['Balance due', money(b.balance)]
    ].filter(function(l){ return l[1] !== undefined && l[1] !== null && l[1] !== ''; })
      .map(function(l){ return '<tr><td style="padding:4px 12px 4px 0;color:#888;">' + esc(l[0]) + '</td><td style="padding:4px 0;color:#111;font-weight:600;">' + esc(l[1]) + '</td></tr>'; }).join('');
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
      + '<h2 style="color:#b8893a;">Your CNK Booths Booking is Confirmed</h2>'
      + '<p style="color:#444;">Hi ' + esc((b.name||'there').split(' ')[0]) + ', thank you for booking with CNK Booths! Here are your details:</p>'
      + '<table style="border-collapse:collapse;font-size:14px;">' + rows + '</table>'
      + (Number(b.balance)>0 ? ('<p style="margin-top:16px;font-size:13px;color:#555;">Your remaining balance of ' + money(b.balance) + ' will be collected before your event.</p>') : '')
      + '<p style="margin-top:16px;font-size:13px;color:#555;">Questions? Just reply to this email or contact us at photos@cnkbooths.com.</p>'
      + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths — Photo Booth Rentals, Utah</p></div>';
    const subject = 'Your CNK Booths booking is confirmed (' + (b.id||'') + ')';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: subject, html: html })
    });
    const out = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, error: (out && out.message) || ('HTTP ' + r.status) }); return; }
    res.status(200).json({ ok: true, id: out.id });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
