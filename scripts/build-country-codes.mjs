// Build a country-name -> ISO alpha-2 map so the place lookup can resolve a
// "City, Country" qualifier typed with a full name ("Paris, France") instead of
// only the 2-letter code. Keys are normalized the same way place-lookup does.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const countries = require('world-countries'); // has cca2 + name.common

// Mirror place-lookup.js normalizeName: NFD, strip diacritics, lowercase, collapse spaces.
const norm = s => String(s || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const map = {};
for (const c of countries) {
  if (c.cca2 && c.name && c.name.common) map[norm(c.name.common)] = c.cca2;
}

// Common informal names/abbreviations people actually type.
const aliases = {
  usa: 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', england: 'GB', britain: 'GB', 'great britain': 'GB',
  korea: 'KR', 'south korea': 'KR', 'north korea': 'KP',
  russia: 'RU', vietnam: 'VN', 'czech republic': 'CZ',
  uae: 'AE', holland: 'NL', laos: 'LA', syria: 'SY',
  'ivory coast': 'CI', 'cape verde': 'CV', burma: 'MM'
};
for (const [k, v] of Object.entries(aliases)) map[norm(k)] = v;

mkdirSync('data', { recursive: true });
writeFileSync('data/country-codes.json', JSON.stringify(map));
console.log(`country-codes: ${Object.keys(map).length} names`);
