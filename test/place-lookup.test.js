import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, lookup } from '../js/place-lookup.js';

const cities = [
  { name: 'Paris', lat: 48.85, lng: 2.35, country: 'FR' },
  { name: 'Paris', lat: 33.66, lng: -95.55, country: 'US' },
  { name: 'São Paulo', lat: -23.55, lng: -46.63, country: 'BR' },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, country: 'JP' }
];

test('normalizeName strips accents and case', () => {
  assert.equal(normalizeName('São Paulo'), 'sao paulo');
  assert.equal(normalizeName('  TOKYO '), 'tokyo');
});

test('exact match is case-insensitive', () => {
  assert.equal(lookup('tokyo', cities).country, 'JP');
});

test('accent-insensitive match', () => {
  const hit = lookup('sao paulo', cities);
  assert.equal(hit.country, 'BR');
});

test('"City, Country" narrows by country', () => {
  assert.equal(lookup('Paris, US', cities).country, 'US');
  assert.equal(lookup('Paris, France', cities).country, 'FR'); // FR name contains "fr"? no -> falls back to first Paris
});

test('no match returns null', () => {
  assert.equal(lookup('Atlantis', cities), null);
  assert.equal(lookup('', cities), null);
});

test('partial (startsWith) match works', () => {
  assert.equal(lookup('Tok', cities).name, 'Tokyo');
});
