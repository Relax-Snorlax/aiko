import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegionCode, isStateCode, visitedRegionSet, isRegionVisited,
  regionRowId, toggleRegionAction, destinationPlaces, nextDestinationStatus, progress
} from '../js/places-model.js';

const places = [
  { id: 'r1', kind: 'region', code: 'US-CA' },
  { id: 'r2', kind: 'region', code: 'fr' },
  { id: 'd1', kind: 'destination', name: 'Paris', status: 'wish' }
];

test('normalizeRegionCode upper-trims', () => {
  assert.equal(normalizeRegionCode(' us-ca '), 'US-CA');
});

test('isStateCode distinguishes states from countries', () => {
  assert.equal(isStateCode('US-CA'), true);
  assert.equal(isStateCode('FR'), false);
  assert.equal(isStateCode('US'), false);
});

test('visitedRegionSet normalizes codes', () => {
  const s = visitedRegionSet(places);
  assert.ok(s.has('US-CA') && s.has('FR'));
  assert.equal(s.size, 2);
});

test('isRegionVisited is case-insensitive', () => {
  assert.equal(isRegionVisited(places, 'fr'), true);
  assert.equal(isRegionVisited(places, 'DE'), false);
});

test('regionRowId returns id or null', () => {
  assert.equal(regionRowId(places, 'US-CA'), 'r1');
  assert.equal(regionRowId(places, 'DE'), null);
});

test('toggleRegionAction add vs remove', () => {
  assert.deepEqual(toggleRegionAction(places, 'US-CA'), { action: 'remove', id: 'r1' });
  assert.deepEqual(toggleRegionAction(places, 'de'), { action: 'add', code: 'DE' });
});

test('destinationPlaces filters', () => {
  assert.equal(destinationPlaces(places).length, 1);
});

test('nextDestinationStatus toggles', () => {
  assert.equal(nextDestinationStatus('wish'), 'visited');
  assert.equal(nextDestinationStatus('visited'), 'wish');
});

test('progress splits states and countries', () => {
  const p = progress(places, 50, 195);
  assert.deepEqual(p.states, { visited: 1, total: 50 });
  assert.deepEqual(p.countries, { visited: 1, total: 195 });
});
