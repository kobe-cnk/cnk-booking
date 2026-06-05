module.exports = async function (req, res) {
  try {
    var q = (req.query && (req.query.text || req.query.q)) || '';
    var text = String(q).trim();
    if (text.length < 3) { return res.status(200).json({ ok: true, suggestions: [] }); }
    var KEY = process.env.ORS_API_KEY;
    if (!KEY) { return res.status(200).json({ ok: false, suggestions: [], error: 'missing key' }); }
    var url = 'https://api.openrouteservice.org/geocode/autocomplete'
      + '?api_key=' + encodeURIComponent(KEY)
      + '&text=' + encodeURIComponent(text)
      + '&focus.point.lon=-111.822529&focus.point.lat=40.377802'
      + '&size=6';
    var r = await fetch(url);
    var j = await r.json();
    var feats = (j && j.features) || [];
    var suggestions = feats.map(function (f) {
      var p = f.properties || {};
      var g = (f.geometry && f.geometry.coordinates) || [];
      var house = p.housenumber || '';
      var street = p.street || '';
      var line1 = (house && street) ? (house + ' ' + street) : (street || p.name || '');
      return {
        label: p.label || '',
        street: line1,
        city: p.locality || p.localadmin || p.county || '',
        state: p.region_a || p.region || '',
        zip: p.postalcode || '',
        lon: g[0], lat: g[1]
      };
    }).filter(function (s) { return s.label; });
    return res.status(200).json({ ok: true, suggestions: suggestions });
  } catch (e) {
    return res.status(200).json({ ok: false, suggestions: [], error: String(e) });
  }
};