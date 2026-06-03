// Auto delivery distance via OpenRouteService.
// Geocodes a customer address, computes one-way driving distance from the CNK warehouse,
// derives round-trip miles, and returns the delivery fee.
// Requires env var ORS_API_KEY (free key from openrouteservice.org).

const ORS_KEY = process.env.ORS_API_KEY;

// CNK warehouse: 19 N 900 W, American Fork, UT 84003 (geocoded once; lon,lat order for ORS)
const WAREHOUSE = { lon: -111.822529, lat: 40.377802 };

const INCLUDED_MILES = 50;       // round-trip miles included
const PER_MILE = 1.25;           // $ per mile beyond included
const METERS_PER_MILE = 1609.344;

async function geocode(address) {
  const url = 'https://api.openrouteservice.org/geocode/search'
    + '?api_key=' + encodeURIComponent(ORS_KEY)
    + '&text=' + encodeURIComponent(address)
    + '&boundary.country=US&size=1';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Geocode failed (' + r.status + ')');
  const d = await r.json();
  if (!d.features || !d.features.length) throw new Error('Address not found');
  const f = d.features[0];
  const p = f.properties || {};
  return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label: p.label, confidence: p.confidence, layer: p.layer, hasNumber: !!p.housenumber };
}

async function drivingMeters(from, to) {
  const r = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
    method: 'POST',
    headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [[from.lon, from.lat], [to.lon, to.lat]],
      metrics: ['distance'], units: 'm'
    })
  });
  if (!r.ok) throw new Error('Distance failed (' + r.status + ')');
  const d = await r.json();
  const meters = d.distances && d.distances[0] && d.distances[0][1];
  if (meters == null) throw new Error('No route found');
  return meters;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!ORS_KEY) { res.status(500).json({ error: 'Map service not configured' }); return; }
  try {
    const address = (req.body && req.body.address ? String(req.body.address) : '').trim();
    if (address.length < 5) { res.status(400).json({ error: 'Please enter a valid address' }); return; }

    const dest = await geocode(address);
    const precise = dest.hasNumber || ['address','street','venue'].indexOf(dest.layer) !== -1;
    if (!precise || (typeof dest.confidence === 'number' && dest.confidence < 0.5)) {
      res.status(200).json({ ok: false, error: 'Please enter a full street address (number, street, city, state)', needAddress: true, matched: dest.label });
      return;
    }
    const oneWayMeters = await drivingMeters(WAREHOUSE, dest);
    const oneWayMiles = oneWayMeters / METERS_PER_MILE;
    const roundTripMiles = Math.round(oneWayMiles * 2);
    const billable = Math.max(0, roundTripMiles - INCLUDED_MILES);
    const fee = Math.round(billable * PER_MILE * 100) / 100;

    res.status(200).json({
      ok: true,
      address: dest.label || address,
      oneWayMiles: Math.round(oneWayMiles * 10) / 10,
      roundTripMiles: roundTripMiles,
      includedMiles: INCLUDED_MILES,
      billableMiles: billable,
      fee: fee
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
