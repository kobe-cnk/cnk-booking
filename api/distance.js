// Delivery distance + fee from the CNK warehouse (American Fork, UT).
// POST { address, cityFallback } ->
//   { ok, address, oneWayMiles, roundTripMiles, includedMiles, billableMiles, fee, approx? }
// Tries the full street address first (accepts street-level matches, incl. Utah grid
// addresses). If that fails (venue names, "Highway 80 Exit 131", etc.), falls back to
// the city/state/ZIP so every booking still gets a usable delivery quote, flagged approx.
const ORS_KEY = process.env.ORS_API_KEY;
const WAREHOUSE = [-111.822529, 40.377802]; // lon, lat — 19 N 900 W, American Fork, UT
const INCLUDED_MILES = 50;
const RATE_PER_MILE = 1.25;

async function geocode(text) {
  const url = 'https://api.openrouteservice.org/geocode/search?api_key='
    + encodeURIComponent(ORS_KEY)
    + '&text=' + encodeURIComponent(text)
    + '&boundary.country=US&size=1';
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const f = d.features && d.features[0];
  if (!f) return null;
  return { coords: f.geometry.coordinates, label: f.properties.label, layer: f.properties.layer };
}

async function drivingMiles(destCoords) {
  const r = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
    method: 'POST',
    headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: [WAREHOUSE, destCoords], sources: [0], destinations: [1], metrics: ['distance'], units: 'mi' })
  });
  if (!r.ok) return null;
  const d = await r.json();
  const mi = d.distances && d.distances[0] && d.distances[0][0];
  return (typeof mi === 'number') ? mi : null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query && (req.query.ac || req.query.autocomplete)) {
    try {
      var __t = String((req.query.text || req.query.q || '')).trim();
      if (__t.length < 3) { res.status(200).json({ ok: true, suggestions: [] }); return; }
      if (!ORS_KEY) { res.status(200).json({ ok: true, suggestions: [] }); return; }
      var __u = 'https://api.openrouteservice.org/geocode/autocomplete?api_key=' + encodeURIComponent(ORS_KEY) + '&text=' + encodeURIComponent(__t) + '&focus.point.lon=-111.822529&focus.point.lat=40.377802&size=6';
      var __r = await fetch(__u); var __j = await __r.json(); var __f = (__j && __j.features) || [];
      var __s = __f.map(function(f){ var p=f.properties||{}; var gg=(f.geometry&&f.geometry.coordinates)||[]; var hn=p.housenumber||''; var st=p.street||''; var l1=(hn&&st)?(hn+' '+st):(st||p.name||''); return { label:p.label||'', street:l1, city:p.locality||p.localadmin||p.county||'', state:p.region_a||p.region||'', zip:p.postalcode||'', lon:gg[0], lat:gg[1] }; }).filter(function(x){ return x.label; });
      res.status(200).json({ ok: true, suggestions: __s }); return;
    } catch (__e) { res.status(200).json({ ok: true, suggestions: [], error: String(__e) }); return; }
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!ORS_KEY) { res.status(200).json({ ok: false, error: 'Distance service not configured' }); return; }
  try {
    const body = req.body || {};
    const address = String(body.address || '').trim();
    const cityFallback = String(body.cityFallback || '').trim();
    if (address.length < 5 && cityFallback.length < 5) {
      res.status(200).json({ ok: false, error: 'Please enter the event address' });
      return;
    }

    let dest = null, approx = false;

    // 1) Full address: accept precise or street-level matches.
    if (address.length >= 5) {
      const g = await geocode(address);
      if (g && (g.layer === 'address' || g.layer === 'street')) dest = g;
    }

    // 2) Fallback: city/state/ZIP — accept locality/region-level so exits, venue
    //    names, and unusual formats still produce a quote (estimated from city).
    if (!dest && cityFallback.length >= 5) {
      const g2 = await geocode(cityFallback);
      if (g2 && (g2.layer === 'locality' || g2.layer === 'localadmin' || g2.layer === 'borough'
              || g2.layer === 'address' || g2.layer === 'street' || g2.layer === 'postalcode'
              || g2.layer === 'county')) {
        dest = g2; approx = true;
      }
    }

    if (!dest) {
      res.status(200).json({ ok: false, error: 'Could not locate that address — please check the city, state, and ZIP', needAddress: true });
      return;
    }

    const oneWay = await drivingMiles(dest.coords);
    if (oneWay == null) {
      res.status(200).json({ ok: false, error: 'Could not compute driving distance — please try again' });
      return;
    }

    const roundTrip = Math.round(oneWay * 2);
    const billable = Math.max(0, roundTrip - INCLUDED_MILES);
    const fee = Math.round(billable * RATE_PER_MILE * 100) / 100;

    res.status(200).json({
      ok: true,
      address: dest.label,
      approx: approx || undefined,
      oneWayMiles: Math.round(oneWay * 10) / 10,
      roundTripMiles: roundTrip,
      includedMiles: INCLUDED_MILES,
      billableMiles: billable,
      fee: fee
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
