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
    const { rows } = await sql`SELECT id, data FROM bookings`;
    let sent = 0; const details = [];
    for (const row of rows) {
      let b = row.data; if (typeof b === 'string') { try { b = JSON.parse(b); } catch(e){ continue; } }
      if (!b || !b.date) continue;
      const bal = Number(b.balance)||0;
      const status = (b.status||'').toLowerCase();
      if (b.date === target && bal > 0.005 && status !== 'cancelled' && !b.finalReminderSent) {
        const ok = await sendEmail(b);
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
