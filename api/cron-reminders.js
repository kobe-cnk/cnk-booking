// Daily cron: find bookings whose event is EXACTLY 14 days away with a balance still owed,
// email a 'collect final payment' reminder to photos@cnkbooths.com, and mark them reminded
// so each booking only triggers once. Scheduled via vercel.json crons (runs once/day).
const { sql } = require('@vercel/postgres');

const RESEND_KEY = process.env.RESEND_API_KEY;
const TO = 'photos@cnkbooths.com';
const FROM = process.env.RESEND_FROM || 'CNK Booths <onboarding@resend.dev>';

function money(n){ n = Number(n)||0; return '$' + n.toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// Date 14 days from 'today' in America/Denver (Utah), as YYYY-MM-DD
// __cnkCatchUp: today in America/Denver as YYYY-MM-DD
function todayDateStr(){
  const now = new Date();
  const denver = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  const y = denver.getFullYear();
  const m = String(denver.getMonth()+1).padStart(2,'0');
  const d = String(denver.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+d;
}

function targetDateStr(){
  const now = new Date();
  // shift to Denver time to avoid UTC off-by-one
  const denver = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  denver.setDate(denver.getDate() + 14);
  const y = denver.getFullYear();
  const m = String(denver.getMonth()+1).padStart(2,'0');
  const d = String(denver.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + d;
}

// __cnkClientReminder: 2-week final-payment notice sent to the CLIENT (CNK also gets its own copy).
async function sendClientEmail(b){
  const to = String((b && b.email) || '').trim();
  if (!to || to.indexOf('@') === -1) return false;
  const total = Number(b.total != null ? b.total : b.price) || 0;
  const dep = Number(b.deposit) || 0;
  const bal = Number(b.balance != null ? b.balance : (total - dep)) || 0;
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1A1A18;">'
    + '<h2 style="margin:0 0 12px;">Your final payment is coming up</h2>'
    + '<p style="margin:0 0 14px;font-size:15px;">Hi ' + esc(b.name || 'there') + ', we are excited for your event! Your event is about two weeks away, and the remaining balance is now due.</p>'
    + '<table style="font-size:14px;border-collapse:collapse;margin:14px 0;">'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Event date</td><td style="padding:4px 0;font-weight:600;">' + esc(b.date || '') + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Package</td><td style="padding:4px 0;font-weight:600;">' + esc(b.pkgLabel || b.package || '') + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Total</td><td style="padding:4px 0;font-weight:600;">' + money(total) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Deposit paid</td><td style="padding:4px 0;font-weight:600;">' + money(dep) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Balance due</td><td style="padding:4px 0;font-weight:700;color:#8B1A2C;">' + money(bal) + '</td></tr>'
    + '</table>'
    + '<p style="margin:0 0 14px;font-size:14px;">We will reach out to collect the remaining balance before your event. If you have any questions, just reply to this email or call us at (385) 223-6269.</p>'
    + '<p style="margin:0 0 14px;font-size:13px;color:#555;border-left:3px solid #C4983A;padding-left:10px;">As a reminder, per your signed rental agreement the 50% deposit is non-refundable.</p>'
    + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths &middot; photos@cnkbooths.com</p></div>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: TO, subject: 'Final payment due for your CNK Booths event on ' + (b.date || ''), html: html })
    });
    return r.ok;
  } catch (e) { return false; }
}

async function sendEmail(b){
  const finalDue = b.date; // event is 14 days out; reminder is to collect now
  const html = '<div style="font-family:Arial,sans-serif;max-width:560px;">'
    + '<h2 style="color:#b8893a;">Final Payment Due — Event in 2 Weeks</h2>'
    + '<p style="color:#444;">' + esc(b.name||'A client') + '\'s event is on <strong>' + esc(b.date) + '</strong> (14 days away). Time to collect the final payment.</p>'
    + '<table style="border-collapse:collapse;font-size:14px;">'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Reference</td><td style="padding:4px 0;font-weight:600;">' + esc(b.id) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Client</td><td style="padding:4px 0;font-weight:600;">' + esc(b.name) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Phone</td><td style="padding:4px 0;font-weight:600;">' + esc(b.phone||'') + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Event date</td><td style="padding:4px 0;font-weight:600;">' + esc(b.date) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Total</td><td style="padding:4px 0;font-weight:600;">' + money(b.price) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#888;">Paid</td><td style="padding:4px 0;font-weight:600;">' + money(b.deposit) + '</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;color:#c0392b;">Balance to collect</td><td style="padding:4px 0;font-weight:700;color:#c0392b;">' + money(b.balance) + '</td></tr>'
    + '</table>'
    + '<p style="margin-top:16px;font-size:13px;color:#555;">Open the booking in the admin dashboard to charge the balance or record payment.</p>'
    + '<p style="margin-top:20px;font-size:12px;color:#aaa;">CNK Booths booking system · automated reminder</p></div>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject: 'Final payment due in 2 weeks: ' + (b.name||'') + ' (' + (b.id||'') + ')', html: html })
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  // Optional shared-secret check (CRON_SECRET) if set, so only Vercel cron can trigger.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== ('Bearer ' + secret)) { res.status(401).json({ ok:false, error:'Unauthorized' }); return; }
  }
  if (!RESEND_KEY) { res.status(200).json({ ok:false, error:'Email not configured' }); return; }
  try {
    const target = targetDateStr();
    const todayStr = todayDateStr();
    const { rows } = await sql`SELECT id, data FROM bookings`;
    let sent = 0; const details = [];
    for (const row of rows) {
      let b = row.data; if (typeof b === 'string') { try { b = JSON.parse(b); } catch(e){ continue; } }
      if (!b || !b.date) continue;
      const bal = Number(b.balance)||0;
      const status = (b.status||'').toLowerCase();
      if (b.date <= target && b.date >= todayStr && bal > 0.005 && status !== 'cancelled' && !b.finalReminderSent) {
        const ok = await sendEmail(b);
        try { await sendClientEmail(b); } catch (e) { /* client email never blocks the CNK reminder */ }
        if (ok) {
          b.finalReminderSent = new Date().toISOString();
        try { var _to=(b.email||'').trim(); if(process.env.RESEND_API_KEY && _to && _to.indexOf('@')!==-1){ var _first=(b.name||'there').split(' ')[0]; var _html='<div style="font-family:Arial,sans-serif;max-width:560px;"><h2 style="color:#b8893a;">Your CNK Booths Event is 2 Weeks Away!</h2><p>Hi '+_first+', your photo booth rental on <strong>'+(b.date||'')+'</strong> is coming up. Per your rental agreement, the remaining balance is due now (no later than 14 days before your event).</p><p style="font-size:15px;">Balance due: <strong>
          await sql`UPDATE bookings SET data = ${JSON.stringify(b)}::jsonb WHERE id = ${b.id}`;
          sent++; details.push(b.id);
        }
      }
    }
    res.status(200).json({ ok:true, target, sent, details });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
+(Number(b.balance)||0).toFixed(2)+'</strong></p><p>Reply to this email or call (801) 857-5457 to take care of your balance. Thank you!</p><p style="font-size:12px;color:#aaa;">CNK Booths, Photo Booth Rentals, Utah</p></div>'; await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:(process.env.RESEND_FROM||'CNK Booths <onboarding@resend.dev>'),to:[_to],reply_to:'photos@cnkbooths.com',subject:'Your CNK Booths balance is due - event on '+(b.date||''),html:_html})}); b.clientReminderSent=new Date().toISOString(); } } catch(_e){}
          await sql`UPDATE bookings SET data = ${JSON.stringify(b)}::jsonb WHERE id = ${b.id}`;
          sent++; details.push(b.id);
        }
      }
    }
    res.status(200).json({ ok:true, target, sent, details });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e && e.message || e) });
  }
};
