// Convert us-atlas states TopoJSON -> an inline SVG (albersUSA) with one
// <path data-code="US-XX"> per state. Excludes DC and territories to keep 50.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoAlbersUsa, geoPath } from 'd3-geo';

// FIPS state code -> USPS abbreviation (50 states only; DC=11 intentionally omitted).
const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS',
  '21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS',
  '29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY',
  '37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC',
  '46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY'
};

const topo = JSON.parse(readFileSync('node_modules/us-atlas/states-10m.json', 'utf8'));
const states = feature(topo, topo.objects.states);
const width = 960, height = 600;
const path = geoPath(geoAlbersUsa().fitSize([width, height], states));

let paths = '';
let count = 0;
for (const f of states.features) {
  const fips = String(f.id).padStart(2, '0');
  const usps = FIPS_TO_USPS[fips];
  if (!usps) continue; // skip DC / territories
  const d = path(f);
  if (!d) continue;
  const name = (f.properties && f.properties.name) || usps;
  paths += `<path data-code="US-${usps}" data-name="${name}" d="${d}"/>`;
  count++;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="us-map" role="img" aria-label="Map of US states">${paths}</svg>`;

mkdirSync('data', { recursive: true });
writeFileSync('data/us-states.svg', svg);
console.log(`states: ${count} paths`);
