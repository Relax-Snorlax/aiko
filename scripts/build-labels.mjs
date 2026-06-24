// Precompute lat/lng label anchors for the globe's zoom-in labels:
//   - country centroids from the vendored countries-110m.geojson
//   - US state centroids from us-atlas (decoded TopoJSON is lat/lng; the
//     AlbersUSA projection is only applied later for the flat inset)
// POI labels are derived client-side from data/cities.json (population-sorted),
// so they aren't baked here. Output: data/map-labels.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoCentroid, geoArea } from 'd3-geo';

// Anchor a label on the country/state's LARGEST landmass, not the whole-shape
// centroid — otherwise overseas territories (France's Guiana, US's Alaska/
// Hawaii) drag the centroid into the ocean. Returns [lng, lat].
function anchor(f) {
  const g = f.geometry;
  if (!g) return [NaN, NaN];
  if (g.type !== 'MultiPolygon') return geoCentroid(f);
  let best = null, bestArea = -1;
  for (const coords of g.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords };
    const a = geoArea({ type: 'Feature', geometry: poly });
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  return best ? geoCentroid({ type: 'Feature', geometry: best }) : geoCentroid(f);
}

// FIPS -> USPS (50 states; DC/territories omitted) — mirrors build-us-svg.mjs.
const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS',
  '21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS',
  '29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY',
  '37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC',
  '46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY'
};

const round = n => Math.round(n * 1000) / 1000;

// Countries
const world = JSON.parse(readFileSync('data/countries-110m.geojson', 'utf8'));
const countries = [];
for (const f of world.features) {
  const name = f.properties && f.properties.name;
  if (!name) continue;
  const [lng, lat] = anchor(f);
  if (Number.isFinite(lat) && Number.isFinite(lng)) countries.push({ name, lat: round(lat), lng: round(lng) });
}

// US states
const topo = JSON.parse(readFileSync('node_modules/us-atlas/states-10m.json', 'utf8'));
const sFeat = feature(topo, topo.objects.states);
const states = [];
for (const f of sFeat.features) {
  const usps = FIPS_TO_USPS[String(f.id).padStart(2, '0')];
  if (!usps) continue;
  const name = (f.properties && f.properties.name) || usps;
  const [lng, lat] = anchor(f);
  if (Number.isFinite(lat) && Number.isFinite(lng)) states.push({ code: 'US-' + usps, name, lat: round(lat), lng: round(lng) });
}

mkdirSync('data', { recursive: true });
writeFileSync('data/map-labels.json', JSON.stringify({ countries, states }));
console.log(`labels: ${countries.length} countries, ${states.length} states`);
