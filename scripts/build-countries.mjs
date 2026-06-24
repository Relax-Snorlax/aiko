// Convert world-atlas countries TopoJSON -> GeoJSON, attaching ISO alpha-2 codes
// so globe clicks map to the same region codes we persist.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const countriesMeta = require('world-countries'); // array w/ ccn3 (numeric), cca2 (alpha-2)
const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-110m.json', 'utf8'));

const numericToAlpha2 = {};
for (const c of countriesMeta) {
  if (c.ccn3) numericToAlpha2[String(parseInt(c.ccn3, 10))] = c.cca2;
}

const geo = feature(topo, topo.objects.countries);
for (const f of geo.features) {
  const numeric = String(parseInt(f.id, 10));
  f.properties.code = numericToAlpha2[numeric] || '';
}

mkdirSync('data', { recursive: true });
writeFileSync('data/countries-110m.geojson', JSON.stringify(geo));
const withCode = geo.features.filter(f => f.properties.code).length;
console.log(`countries: ${geo.features.length} features, ${withCode} with alpha-2 codes`);
