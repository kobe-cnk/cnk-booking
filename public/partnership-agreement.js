// Shared canonical CNK Booths Venue Partnership Agreement.
// Used by BOTH the signing page (/partnership) and the review page (/partnership-agreement)
// so the document a venue reviews is always identical to what they sign.
(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(d){ if(!d) return '________________'; try{ var dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); }catch(e){ return d; } }
  function fill(v){ return v ? esc(v) : '<span style="color:rgba(245,240,232,0.4)">________________</span>'; }
  window.cnkAgreementHtml = function(f, forEmail){
    f = f || {};
    var venue=f.venue||'', address=f.address||'', signer=f.signer||'', title=f.title||'',
        email=f.email||'', phone=f.phone||'', date=f.date||'', sig=f.sig||'';
  var c = forEmail ? '#111' : 'var(--cream)';
  var dim = forEmail ? '#555' : 'rgba(245,240,232,0.75)';
  var gold = forEmail ? '#b8893a' : 'var(--gold-light)';
  var line = forEmail ? '#333' : 'var(--cream)';
  function H(t){ return '<h3 style="font-family:Georgia,serif;font-size:'+(forEmail?'15px':'19px')+';color:'+gold+';font-weight:bold;margin:18px 0 6px;">'+t+'</h3>'; }
  var s = '';
  s += '<div class="title" style="font-family:Georgia,serif;font-size:'+(forEmail?'20px':'24px')+';color:'+c+';text-align:center;font-weight:bold;">VENUE PARTNERSHIP AGREEMENT</div>';
  s += '<div class="meta" style="text-align:center;color:'+dim+';font-size:12px;margin-bottom:16px;">CNK Booths LLC &middot; Photo Booth Partnership &middot; Version 1.0</div>';
  s += '<p style="color:'+dim+';">This Venue Partnership Agreement (the &ldquo;Agreement&rdquo;) is entered into as of '+fmtDate(date)+' (the &ldquo;Effective Date&rdquo;), by and between <b style="color:'+line+'">CNK Booths LLC</b>, a Utah limited liability company (&ldquo;CNK&rdquo;), and <b style="color:'+line+'">'+fill(venue)+'</b> (the &ldquo;Venue&rdquo;). CNK and the Venue are each a &ldquo;Party&rdquo; and together the &ldquo;Parties.&rdquo;</p>';

  s += H('1. Definitions');
  s += '<ul style="color:'+dim+';margin-left:18px;">'
    + '<li><b style="color:'+line+'">&ldquo;Booth&rdquo;</b> means the photo booth equipment, hardware, software, and supplies CNK installs and operates at the Venue.</li>'
    + '<li><b style="color:'+line+'">&ldquo;Gross Revenue&rdquo;</b> means the total amounts actually collected from users of the Booth at the Venue during the applicable month, before any expenses.</li>'
    + '<li><b style="color:'+line+'">&ldquo;Premises&rdquo;</b> means the Venue&rsquo;s physical location where the Booth is installed.</li>'
    + '<li><b style="color:'+line+'">&ldquo;Term&rdquo;</b> has the meaning given in Section 4.</li></ul>';

  s += H('2. Placement and Services by CNK');
  s += '<p style="color:'+dim+';">CNK owns the Booth and, at no cost to the Venue, will install it on the Premises and provide all maintenance, repairs, supply restocking, and software operation needed to keep it in good working order. CNK will remove the Booth at its own cost upon termination of this Agreement.</p>';

  s += H('3. Venue Responsibilities');
  s += '<p style="color:'+dim+';">The Venue will, at no cost to CNK: (a) provide adequate floor space, electrical power, and Wi-Fi/internet for the Booth; (b) provide CNK reasonable access for installation, servicing, and removal; (c) not move, modify, service, or tamper with the Booth; and (d) promptly notify CNK of any malfunction, damage, or issue with the Booth.</p>';

  s += H('4. Term and Termination');
  s += '<p style="color:'+dim+';">This Agreement begins on the Effective Date and continues for an initial term of ninety (90) days, after which it continues on a month-to-month basis. Either Party may terminate at any time, with or without cause, by giving the other Party at least thirty (30) days&rsquo; prior written notice (email is acceptable). Either Party may terminate immediately for material breach if the breaching Party fails to cure the breach within ten (10) days after written notice (including, for example, non-payment, failure to provide space or power, or tampering with the Booth). Upon termination, CNK will remove the Booth within a reasonable time, and any final revenue share owed to the Venue will be paid in the next regular payout.</p>';

  s += H('5. Revenue Share and Payment');
  s += '<p style="color:'+dim+';">The Venue is entitled to twenty-five percent (25%) of the Gross Revenue collected by the Booth; CNK retains the remaining seventy-five percent (75%). CNK collects all Booth revenue and pays the Venue its 25% share monthly, between the first (1st) and fifth (5th) day of each month, for the prior month. CNK will keep accurate records of Booth revenue and provide the Venue a monthly statement, and the Venue may request reasonable supporting documentation.</p>';

  s += H('6. Exclusivity');
  s += '<p style="color:'+dim+';">During the Term, the Venue will not host, install, or permit any other or competing photo booth on the Premises.</p>';

  s += H('7. Ownership of Equipment');
  s += '<p style="color:'+dim+';">The Booth remains the exclusive property of CNK at all times. The Venue acquires no ownership or other interest in the Booth and will not sell, pledge, encumber, relocate, or allow any lien to attach to it.</p>';

  s += H('8. Damage, Loss, and Responsibility');
  s += '<p style="color:'+dim+';">CNK bears ordinary wear and tear and the ordinary risks of operating the Booth. The Venue is responsible for loss of or damage to the Booth only to the extent caused by the negligence, misuse, or intentional acts of the Venue or its employees, agents, or patrons. Ordinary wear and tear and ordinary operating risks remain CNK&rsquo;s responsibility.</p>';

  s += H('9. Independent Contractors');
  s += '<p style="color:'+dim+';">The Parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, employment, or agency relationship between them, and neither Party may bind the other or incur obligations on the other&rsquo;s behalf.</p>';

  s += H('10. Limitation of Liability');
  s += '<p style="color:'+dim+';">Except for a Party&rsquo;s gross negligence or willful misconduct and except for the damage responsibility described in Section 8, neither Party will be liable to the other for any indirect, incidental, special, or consequential damages, and each Party&rsquo;s total liability arising out of or relating to this Agreement is limited to the amounts paid or payable under this Agreement during the three (3) months before the event giving rise to the claim.</p>';

  s += H('11. Indemnification');
  s += '<p style="color:'+dim+';">Each Party will indemnify and hold the other harmless from third-party claims to the extent arising from its own negligence, willful misconduct, or breach of this Agreement.</p>';

  s += H('12. Confidentiality');
  s += '<p style="color:'+dim+';">The financial terms of this Agreement and any non-public business information either Party shares are confidential and will not be disclosed to others, except as needed for legal, tax, or accounting advice, or as required by law.</p>';

  s += H('13. Governing Law and Dispute Resolution');
  s += '<p style="color:'+dim+';">This Agreement is governed by the laws of the State of Utah. The Parties will first attempt to resolve any dispute informally and in good faith. If a dispute is not resolved within thirty (30) days, the Parties will attempt non-binding mediation in Utah County, Utah, sharing the mediator&rsquo;s fee equally. Any dispute not resolved through mediation will be brought exclusively in the state or federal courts located in Utah County, Utah, and each Party consents to the jurisdiction and venue of those courts.</p>';

  s += H('14. General');
  s += '<p style="color:'+dim+';">This Agreement is the entire agreement between the Parties regarding its subject matter and supersedes any prior discussions. Any amendment must be in writing and signed by both Parties. Neither Party may assign this Agreement without the other&rsquo;s written consent, except that CNK may assign to a successor or affiliate. If any provision is found unenforceable, the remaining provisions remain in effect. Notices sent by email to the addresses the Parties provide are sufficient. Neither Party is liable for delays or failures caused by events beyond its reasonable control. The Parties agree that electronic signatures are valid and binding.</p>';

  // signature block
  s += H('Signatures');
  s += '<p style="color:'+dim+';">By signing below, the Parties agree to the terms of this Agreement as of the Effective Date.</p>';
  s += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;color:'+dim+';"><tr style="vertical-align:top;">'
    + '<td style="width:50%;padding:8px 12px 8px 0;">'
      + '<div style="color:'+line+';font-weight:bold;margin-bottom:8px;">CNK BOOTHS LLC</div>'
      + '<div>By: <span style="font-family:Georgia,serif;font-style:italic;color:'+gold+';font-size:17px;">CNK Booths LLC</span></div>'
      + '<div style="margin-top:6px;">Name / Title: CNK Booths LLC, by its Authorized Member</div>'
      + '<div style="margin-top:6px;">Date: '+fmtDate(date)+'</div>'
      + '<div style="margin-top:6px;font-size:11px;color:'+dim+';">CNK Booths LLC has authorized and executed this Agreement in its business name; no further signature from CNK is required.</div>'
    + '</td>'
    + '<td style="width:50%;padding:8px 0 8px 12px;">'
      + '<div style="color:'+line+';font-weight:bold;margin-bottom:8px;">THE VENUE</div>'
      + '<div>Venue: '+fill(venue)+'</div>'
      + '<div style="margin-top:6px;">By: <span style="font-family:Georgia,serif;font-style:italic;color:'+gold+';font-size:17px;">'+fill(sig)+'</span></div>'
      + '<div style="margin-top:6px;">Name: '+fill(signer)+'</div>'
      + '<div style="margin-top:6px;">Title: '+fill(title)+'</div>'
      + '<div style="margin-top:6px;">Email: '+fill(email)+' &nbsp; Phone: '+fill(phone)+'</div>'
      + '<div style="margin-top:6px;">Address: '+fill(address)+'</div>'
      + '<div style="margin-top:6px;">Date: '+fmtDate(date)+'</div>'
    + '</td></tr></table>';
  return s;
  };
})();
