import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('countries geojson parses with codes', () => {
  const geo = JSON.parse(readFileSync('data/countries-110m.geojson', 'utf8'));
  assert.equal(geo.type, 'FeatureCollection');
  assert.ok(geo.features.length >= 150, 'expected >=150 country features');
  const coded = geo.features.filter(f => f.properties.code && f.properties.code.length === 2);
  assert.ok(coded.length >= 150, 'expected most features to have alpha-2 codes');
});

test('us-states svg has exactly 50 coded paths', () => {
  const svg = readFileSync('data/us-states.svg', 'utf8');
  const matches = svg.match(/data-code="US-[A-Z]{2}"/g) || [];
  assert.equal(matches.length, 50);
});

test('cities json is a non-trivial array of points', () => {
  const cities = JSON.parse(readFileSync('data/cities.json', 'utf8'));
  assert.ok(Array.isArray(cities));
  assert.ok(cities.length >= 1000, 'expected >=1000 cities');
  const c = cities[0];
  assert.ok(typeof c.name === 'string' && typeof c.lat === 'number' && typeof c.lng === 'number');
});
