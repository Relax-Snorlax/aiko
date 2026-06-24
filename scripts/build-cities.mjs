// Trim a GeoNames-derived city list to major cities for name->coords lookup.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const allCities = require('all-the-cities'); // GeoNames-derived, CC-BY 4.0

const MIN_POP = 200000; // ~2-3k cities; small-nation capitals below this fall back to manual drop
const cities = allCities
  .filter(c => c.population >= MIN_POP)
  // Sort by population desc so a bare name (e.g. "Paris") resolves to the most
  // prominent match (Paris, FR) rather than an arbitrary same-named small town.
  .sort((a, b) => b.population - a.population)
  .map(c => ({
    name: c.name,
    lat: c.loc.coordinates[1],
    lng: c.loc.coordinates[0],
    country: c.country // ISO alpha-2
  }));

mkdirSync('data', { recursive: true });
writeFileSync('data/cities.json', JSON.stringify(cities));
console.log(`cities: ${cities.length}`);
