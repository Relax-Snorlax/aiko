import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, lookup } from '../js/place-lookup.js';

const cities = [
  // Order matters: London GB first (most populous) so the no-alias fallback
  // would pick GB — the alias test proves the qualifier actually narrows.
  { name: 'London', lat: 51.5, lng: -0.12, country: 'GB' },
  { name: 'London', lat: 42.98, lng: -81.25, country: 'CA' },
  { name: 'Paris', lat: 48.85, lng: 2.35, country: 'FR' },
  { name: 'Paris', lat: 33.66, lng: -95.55, country: 'US' },
  { name: 'São Paulo', lat: -23.55, lng: -46.63, country: 'BR' },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, country: 'JP' }
];

const aliases = { france: 'FR', canada: 'CA', usa: 'US' };

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

test('"City, Country" narrows by alpha-2 code', () => {
  assert.equal(lookup('Paris, US', cities).country, 'US');
  assert.equal(lookup('London, CA', cities).country, 'CA');
});

test('full country name narrows when an alias map is supplied', () => {
  assert.equal(lookup('London, Canada', cities, aliases).country, 'CA');
  assert.equal(lookup('Paris, France', cities, aliases).country, 'FR');
  // unresolved/absent alias falls back to the most prominent same-named city (no crash)
  assert.equal(lookup('London, Canada', cities).country, 'GB');
  assert.equal(lookup('London, Atlantis', cities, aliases).country, 'GB');
});

test('no match returns null', () => {
  assert.equal(lookup('Atlantis', cities), null);
  assert.equal(lookup('', cities), null);
});

test('partial (startsWith) match works', () => {
  assert.equal(lookup('Tok', cities).name, 'Tokyo');
});
