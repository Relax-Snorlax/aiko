# Our World — Interactive Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive 3D globe ("Our World") to the Ren & Aiko dashboard that works as a shared travel checklist — click countries (on a globe) and US states (in a flat drill-in) to mark them visited, add wishlist destination pins by name — plus a one-time announcement introducing it to Linh.

**Architecture:** Zero-build static site (`index.html` + classic `app.js` IIFE + `style.css`) on GitHub Pages, backed by Google Apps Script + Sheets. The feature adds: a new sheet + two backend actions; vendored geo/city data; pure ES-module logic (unit-tested with Node's built-in runner); browser-only ES modules for the globe (globe.gl) and the SVG US inset; and small `app.js` integration (expose an API bridge, dispatch a ready event, generalize the announcement system).

**Tech Stack:** Vanilla JS (classic IIFE + ES modules), globe.gl (three.js) via pinned ESM CDN, inline SVG (albersUSA), Google Apps Script, `node --test` for pure-logic unit tests, build-only devDeps (world-atlas, us-atlas, topojson-client, d3-geo, world-countries, all-the-cities) for one-off data vendoring.

## Global Constraints

These apply to **every** task:

- **Node ≥ 18** required for `node --test` (dev has v22). Tests live in `test/`, named `*.test.js`.
- **`package.json` has `"type": "module"`** so `.js` files under `js/` and `test/` are ES modules in Node. The browser loads them via `<script type="module">`. `app.js` stays a classic browser script (Node never runs it).
- **Pin the globe.gl version** in the import URL: `https://esm.sh/globe.gl@2.46.1` (verified to resolve `200` on esm.sh; latest as of 2026-06-24). Do not use an unpinned/`latest` URL. Task 7 spikes it before relying on it.
- **Vendor all geometry/city data into `data/`** — committed JSON/SVG. Only the globe.gl library loads from a CDN at runtime.
- **Testing strategy (deliberate):** automated unit tests only for the **pure** modules (`places-model.js`, `place-lookup.js`) and **data-shape** checks. Browser-rendering modules (`globe-view.js`, `us-inset.js`, `our-world.js`), CSS, and the Apps Script backend get **manual verification steps** — no DOM/E2E framework is added (would violate the site's lean, dependency-light ethos). This was approved in the spec.
- **Section name is "Our World".** Region codes: US states = `US-XX` (USPS), countries = ISO-3166 alpha-2 (e.g. `FR`); the USA country itself is `US`.
- **No forced re-login** in the globe announcement. **Shared** map (not per-user). **Points-on-visit** enabled via `action_type = "place"`.
- **Theme tokens:** bg `#0a0a0f`, primary mauve `#c782af`, cream `#f5e6d3`, border `#2a1f3d`. Reuse existing glow/`tierBreathe` language.
- **Local preview** (manual verification) must bind `0.0.0.0` and be opened at `http://pc-bp3-wsl:<port>` (remote-access setup) — e.g. `python3 -m http.server 8099 --bind 0.0.0.0`.
- **Frequent commits:** one commit per task (per the final Step). Work on branch `feature/our-world-globe` (already created).
- **Security/licensing:** vendored data must be attributed in `data/CREDITS.md` (GeoNames/Natural Earth/US Census are CC-BY or public domain). Never weaken the existing password gate, points cooldown, or the `editEntry`/`deleteEntry` sheet allowlist.

---

## File Structure

**Create:**
- `package.json` — Node module flag + `test` / `build:data` scripts + build-only devDeps
- `scripts/build-countries.mjs` — TopoJSON→GeoJSON countries, attach alpha-2 codes
- `scripts/build-us-svg.mjs` — TopoJSON→inline SVG US states (albersUSA), `data-code="US-XX"`
- `scripts/build-cities.mjs` — trim a cities dataset to `{name,lat,lng,country}`
- `data/countries-110m.geojson` — vendored (build output)
- `data/us-states.svg` — vendored (build output)
- `data/cities.json` — vendored (build output)
- `data/CREDITS.md` — data attributions
- `js/places-model.js` — pure: region/visited/progress/toggle logic
- `js/place-lookup.js` — pure: name → coordinates
- `js/globe-view.js` — globe.gl globe (browser-only)
- `js/us-inset.js` — SVG US inset (browser-only)
- `js/our-world.js` — feature entry/wiring (browser-only)
- `test/places-model.test.js`, `test/place-lookup.test.js`, `test/data.test.js`

**Modify:**
- `apps-script/Code.gs` — `Places` sheet support (`getPlaces`, `addPlace`, allowlist)
- `app.js` — expose `window.RenAiko` bridge, dispatch `dashboard:ready`, generalize announcements, add globe-announcement cookie
- `index.html` — nav link, Our World section, add-destination modal, globe-announcement modal, module `<script>`
- `style.css` — section, globe, glow/visited, pins, inset, progress, modal, announcement
- `.gitignore` — ignore `node_modules/`

---

## Task 1: Test/build scaffolding + vendored data

**Files:**
- Create: `package.json`, `.gitignore` (modify), `scripts/build-countries.mjs`, `scripts/build-us-svg.mjs`, `scripts/build-cities.mjs`, `data/CREDITS.md`
- Output (committed): `data/countries-110m.geojson`, `data/us-states.svg`, `data/cities.json`
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `data/countries-110m.geojson` (GeoJSON FeatureCollection; each feature `properties.code` = ISO alpha-2), `data/us-states.svg` (`<svg class="us-map">` with `<path data-code="US-XX" data-name="...">` for the 50 states), `data/cities.json` (array of `{name, lat, lng, country}`).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ren-aiko-site",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build:data": "node scripts/build-countries.mjs && node scripts/build-us-svg.mjs && node scripts/build-cities.mjs"
  },
  "devDependencies": {
    "all-the-cities": "^3.1.0",
    "d3-geo": "^3.1.1",
    "topojson-client": "^3.1.0",
    "us-atlas": "^3.0.1",
    "world-atlas": "^2.0.2",
    "world-countries": "^5.0.0"
  }
}
```

- [ ] **Step 2: Add `node_modules/` to `.gitignore`**

Append to `.gitignore`:

```
# node build tooling (build-only; outputs in data/ are committed)
node_modules/
```

- [ ] **Step 3: Install build-only deps**

Run: `npm install`
Expected: `node_modules/` populated; no errors. (These are build-only; not shipped to the browser.)

- [ ] **Step 4: Write `scripts/build-countries.mjs`**

```js
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
```

- [ ] **Step 5: Write `scripts/build-us-svg.mjs`**

```js
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
```

- [ ] **Step 6: Write `scripts/build-cities.mjs`**

```js
// Trim a GeoNames-derived city list to major cities for name->coords lookup.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const allCities = require('all-the-cities'); // GeoNames-derived, CC-BY 4.0

const MIN_POP = 200000; // ~2-3k cities; small-nation capitals below this fall back to manual drop
const cities = allCities
  .filter(c => c.population >= MIN_POP)
  .map(c => ({
    name: c.name,
    lat: c.loc.coordinates[1],
    lng: c.loc.coordinates[0],
    country: c.country // ISO alpha-2
  }));

mkdirSync('data', { recursive: true });
writeFileSync('data/cities.json', JSON.stringify(cities));
console.log(`cities: ${cities.length}`);
```

- [ ] **Step 7: Write `data/CREDITS.md`**

```markdown
# Vendored data credits

- `countries-110m.geojson` — derived from [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain).
- `us-states.svg` — derived from [us-atlas](https://github.com/topojson/us-atlas) (US Census Bureau, public domain).
- `cities.json` — derived from [all-the-cities](https://github.com/zeke/all-the-cities) / [GeoNames](https://www.geonames.org/), licensed CC-BY 4.0.
```

- [ ] **Step 8: Build the data**

Run: `npm run build:data`
Expected: prints country/state/city counts; creates the three files under `data/`. Country features ≈ 177, with most having alpha-2 codes; states = 50; cities ≈ 2000–3000.

- [ ] **Step 9: Write `test/data.test.js`**

```js
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
```

- [ ] **Step 10: Run the data tests**

Run: `node --test test/data.test.js`
Expected: 3 tests pass.

- [ ] **Step 11: Commit**

```bash
git add package.json .gitignore scripts/ data/ test/data.test.js
git commit -m "build: vendor globe/US/city data + node:test harness

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 2: `places-model.js` (pure logic, TDD)

**Files:**
- Create: `js/places-model.js`
- Test: `test/places-model.test.js`

**Interfaces:**
- Produces (used by `our-world.js`):
  - `normalizeRegionCode(code) -> string`
  - `isStateCode(code) -> boolean`
  - `visitedRegionSet(places) -> Set<string>`
  - `isRegionVisited(places, code) -> boolean`
  - `regionRowId(places, code) -> string | null`
  - `toggleRegionAction(places, code) -> {action:'add', code} | {action:'remove', id}`
  - `destinationPlaces(places) -> place[]`
  - `nextDestinationStatus(status) -> 'wish' | 'visited'`
  - `progress(places, totalStates, totalCountries) -> {states:{visited,total}, countries:{visited,total}}`
- A `place` object: `{ id, kind:'region'|'destination', code, name, lat, lng, status, added_by }`.

- [ ] **Step 1: Write the failing test** — `test/places-model.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/places-model.test.js`
Expected: FAIL — `Cannot find module '../js/places-model.js'`.

- [ ] **Step 3: Write minimal implementation** — `js/places-model.js`

```js
// Pure helpers for the visited-places model. No DOM, no network.
// A `place` row: { id, kind:'region'|'destination', code, name, lat, lng, status }.
// For regions, presence of a row means visited; absence means unvisited (glowing).

/** Uppercase + trim a region code. */
export function normalizeRegionCode(code) {
  return String(code || '').trim().toUpperCase();
}

/** True for a US state code like "US-CA". */
export function isStateCode(code) {
  return /^US-[A-Z]{2}$/.test(normalizeRegionCode(code));
}

/** Region rows only. */
export function regionPlaces(places) {
  return (places || []).filter(p => p && p.kind === 'region');
}

/** Set of visited region codes (normalized). */
export function visitedRegionSet(places) {
  return new Set(regionPlaces(places).map(p => normalizeRegionCode(p.code)));
}

/** Is a region visited? */
export function isRegionVisited(places, code) {
  return visitedRegionSet(places).has(normalizeRegionCode(code));
}

/** Row id for a visited region (to delete on toggle-off), or null. */
export function regionRowId(places, code) {
  const c = normalizeRegionCode(code);
  const row = regionPlaces(places).find(p => normalizeRegionCode(p.code) === c);
  return row ? row.id : null;
}

/** What a region click should do: add a row, or remove the existing one. */
export function toggleRegionAction(places, code) {
  const c = normalizeRegionCode(code);
  const id = regionRowId(places, c);
  return id ? { action: 'remove', id } : { action: 'add', code: c };
}

/** Destination rows only. */
export function destinationPlaces(places) {
  return (places || []).filter(p => p && p.kind === 'destination');
}

/** Next status when toggling a destination pin. */
export function nextDestinationStatus(status) {
  return status === 'visited' ? 'wish' : 'visited';
}

/** Visited counts split into states vs countries. */
export function progress(places, totalStates, totalCountries) {
  const codes = [...visitedRegionSet(places)];
  const states = codes.filter(isStateCode).length;
  const countries = codes.filter(c => !isStateCode(c)).length;
  return {
    states: { visited: states, total: totalStates },
    countries: { visited: countries, total: totalCountries }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/places-model.test.js`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/places-model.js test/places-model.test.js
git commit -m "feat(globe): pure places model (visited set, toggle, progress)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 3: `place-lookup.js` (pure logic, TDD)

**Files:**
- Create: `js/place-lookup.js`
- Test: `test/place-lookup.test.js`

**Interfaces:**
- Produces (used by `our-world.js`):
  - `normalizeName(s) -> string`
  - `lookup(query, cities) -> { name, lat, lng, country } | null` where `cities` is the `data/cities.json` array.

- [ ] **Step 1: Write the failing test** — `test/place-lookup.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/place-lookup.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** — `js/place-lookup.js`

```js
// Pure place-name -> coordinates lookup against a provided cities array.
// city: { name, lat, lng, country }  (country is ISO alpha-2).

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip combining diacritics (Unicode property; copy-safe)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best match for a free-text query. Supports an optional "City, Country"
 * qualifier (matched against the alpha-2 country code, case-insensitively).
 * Returns { name, lat, lng, country } or null.
 */
export function lookup(query, cities) {
  const raw = String(query || '').trim();
  if (!raw || !Array.isArray(cities) || !cities.length) return null;

  let namePart = raw, countryPart = '';
  const comma = raw.lastIndexOf(',');
  if (comma > -1) {
    namePart = raw.slice(0, comma);
    countryPart = normalizeName(raw.slice(comma + 1));
  }
  const q = normalizeName(namePart);
  if (!q) return null;

  const inCountry = c => !countryPart || normalizeName(c.country) === countryPart;

  let hit =
    cities.find(c => normalizeName(c.name) === q && inCountry(c)) ||
    cities.find(c => normalizeName(c.name) === q) ||
    cities.find(c => normalizeName(c.name).startsWith(q) && inCountry(c)) ||
    cities.find(c => normalizeName(c.name).startsWith(q)) ||
    cities.find(c => normalizeName(c.name).includes(q) && inCountry(c)) ||
    cities.find(c => normalizeName(c.name).includes(q)) ||
    null;

  if (!hit) return null;
  return { name: hit.name, lat: hit.lat, lng: hit.lng, country: hit.country };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/place-lookup.test.js`
Expected: 6 tests pass. (Note: `"Paris, France"` → country qualifier `france` ≠ alpha-2 `fr`, so it falls through to the first `Paris` = FR, which the test asserts.)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests across `test/` pass (data + places-model + place-lookup).

- [ ] **Step 6: Commit**

```bash
git add js/place-lookup.js test/place-lookup.test.js
git commit -m "feat(globe): pure place-name lookup (accent/case-insensitive)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 4: Backend — `Places` sheet (`apps-script/Code.gs`)

**Files:**
- Modify: `apps-script/Code.gs`

**Interfaces:**
- Produces (HTTP): `GET ?action=getPlaces` → array of place rows; `POST action=addPlace` with `{kind, code, name, lat, lng, status, user, notes}` → `{success, id, points_awarded}`. Region toggle-off and destination edits reuse existing `deleteEntry`/`editEntry` with `sheet=Places`.
- `Places` columns: `id, date, kind, code, name, lat, lng, status, added_by, notes`.

- [ ] **Step 1: Add `Places` to the editable-sheets allowlist**

In `apps-script/Code.gs`, modify the `EDITABLE_SHEETS` object (currently ends at the `Feedback` line) to add a `Places` entry:

```js
var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description'],
  'Feedback': ['hearts', 'comment'],
  'Places':   ['kind', 'code', 'name', 'lat', 'lng', 'status', 'added_by', 'notes']
};
```

- [ ] **Step 2: Add the `PLACES_HEADERS` constant**

Immediately after the `FEEDBACK_HEADERS` line, add:

```js
var PLACES_HEADERS = ['id', 'date', 'kind', 'code', 'name', 'lat', 'lng', 'status', 'added_by', 'notes'];
```

- [ ] **Step 3: Register `getPlaces` in `doGet`**

In `doGet`'s `switch`, add a case before `default`:

```js
      case 'getPlaces':     return respond(getPlaces());
```

- [ ] **Step 4: Register `addPlace` in `doPost`**

In `doPost`'s `switch`, add a case before `default`:

```js
      case 'addPlace':         result = addPlace(e.parameter); break;
```

- [ ] **Step 5: Implement `getPlaces` and `addPlace`**

Add these functions near the other read/write operations (e.g., after `getFeedback`):

```js
function getPlaces() {
  ensureSheet('Places', PLACES_HEADERS);
  return sheetToObjects('Places');
}

function addPlace(params) {
  var kind = params.kind;
  if (kind !== 'region' && kind !== 'destination') {
    return { error: 'Invalid kind' };
  }
  var sheet = ensureSheet('Places', PLACES_HEADERS);
  var id = Utilities.getUuid();
  var date = new Date().toISOString();
  var status = params.status || (kind === 'region' ? 'visited' : 'wish');
  sheet.appendRow([
    id, date, kind,
    params.code || '', params.name || '',
    params.lat || '', params.lng || '',
    status, params.user || '', params.notes || ''
  ]);
  var award = awardPointsIfEligible(params.user, 'place', id);
  return { success: true, id: id, date: date, points_awarded: award ? award.amount : 0 };
}
```

- [ ] **Step 6: Deploy the Apps Script**

In the Apps Script editor (Extensions → Apps Script from the bound Sheet): **Deploy → Manage deployments → edit the existing Web App deployment → Deploy** (new version). This keeps the same `/exec` URL that `app.js` already uses.

- [ ] **Step 7: Manually verify the backend**

Run (replace `<SCRIPT_URL>` with `CONFIG.SCRIPT_URL` from `app.js`):

```bash
curl -sL "<SCRIPT_URL>?action=getPlaces"
```

Expected: `[]` (empty array) on first call — confirms the `Places` tab was auto-created and reads cleanly. (Write paths are exercised end-to-end in Task 9 manual verification, since `addPlace` uses the iframe/postMessage POST flow.)

- [ ] **Step 8: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(backend): Places sheet with getPlaces/addPlace + edit/delete allowlist

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 5: `app.js` integration (API bridge, ready event, announcements)

**Files:**
- Modify: `app.js`

**Interfaces:**
- Produces: `window.RenAiko = { apiGet, apiPost, getCookie, setCookie, openModal, closeModal, CONFIG }` (used by `our-world.js`); a `document` event `dashboard:ready` dispatched at the end of `loadDashboard`; a global flag `window.__dashboardReady` set true alongside it.
- Consumes: existing `CONFIG`, `apiGet`, `apiPost`, `getCookie`, `setCookie`, `openModal`, `closeModal`, `forceLogout`, `maybeShowAnnouncement`, `initAnnouncement`.

- [ ] **Step 1: Add the globe-announcement cookie to `CONFIG`**

In the `CONFIG` object, add after `SEEN_ANNOUNCE_COOKIE`:

```js
    SEEN_ANNOUNCE_COOKIE: 'ren-aiko-seen-rate-points',
    SEEN_ANNOUNCE_GLOBE_COOKIE: 'ren-aiko-seen-globe'
```

(Replace the existing `SEEN_ANNOUNCE_COOKIE` line — which ends the object — so the trailing comma is added correctly.)

- [ ] **Step 2: Replace the announcement helpers**

Replace `markAnnouncementSeen` (in Utilities) and the entire `initAnnouncement` + `maybeShowAnnouncement` block (in the Feature Announcement section) with the generalized versions below.

Remove the old `markAnnouncementSeen`:

```js
  function markSeen(cookie) {
    setCookie(cookie, '1', 3650);
  }
```

Replace the Feature Announcement section:

```js
  // ============================================
  // Feature Announcements (one-time, Linh only)
  // Shows at most one unseen announcement per load, in priority order.
  // ============================================
  var ANNOUNCEMENTS = [
    { cookie: CONFIG.SEEN_ANNOUNCE_GLOBE_COOKIE, modalId: 'announce-globe-modal' },
    { cookie: CONFIG.SEEN_ANNOUNCE_COOKIE,       modalId: 'announce-modal' }
  ];

  function wireSeen(modalId, cookie) {
    var modal = $(modalId);
    if (!modal) return;
    var x = modal.querySelector('.modal-x');
    if (x) x.addEventListener('click', function () { markSeen(cookie); });
    var bg = modal.querySelector('.modal-bg');
    if (bg) bg.addEventListener('click', function () { markSeen(cookie); });
  }

  function initAnnouncement() {
    // Rate/points announcement: its button logs out (needs user cookie for points).
    var logoutBtn = $('announce-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        markSeen(CONFIG.SEEN_ANNOUNCE_COOKIE);
        forceLogout();
      });
    }
    // Globe announcement: its button just opens Our World (no re-login).
    var exploreBtn = $('announce-globe-btn');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', function () {
        markSeen(CONFIG.SEEN_ANNOUNCE_GLOBE_COOKIE);
        closeModal('announce-globe-modal');
        var section = $('our-world-section');
        var link = document.querySelector('.nav-link[data-section="our-world-section"]');
        if (section && section.classList.contains('hidden') && link) link.click();
      });
    }
    wireSeen('announce-modal', CONFIG.SEEN_ANNOUNCE_COOKIE);
    wireSeen('announce-globe-modal', CONFIG.SEEN_ANNOUNCE_GLOBE_COOKIE);
  }

  function maybeShowAnnouncement() {
    if (getCookie(CONFIG.USER_COOKIE) !== 'Linh') return;
    for (var i = 0; i < ANNOUNCEMENTS.length; i++) {
      var an = ANNOUNCEMENTS[i];
      if (!getCookie(an.cookie)) {
        var m = $(an.modalId);
        if (m) { show(m); return; }
      }
    }
  }
```

- [ ] **Step 3: Dispatch `dashboard:ready` at the end of `loadDashboard`**

In `loadDashboard`, after `maybeShowAnnouncement();`, add:

```js
    window.__dashboardReady = true;
    document.dispatchEvent(new CustomEvent('dashboard:ready'));
```

- [ ] **Step 4: Expose the `window.RenAiko` bridge**

At the very end of the IIFE, just before `document.addEventListener('DOMContentLoaded', init);`, add:

```js
  // Bridge for the Our World ES module (separate module scope can't see IIFE internals).
  window.RenAiko = {
    apiGet: apiGet,
    apiPost: apiPost,
    getCookie: getCookie,
    setCookie: setCookie,
    openModal: openModal,
    closeModal: closeModal,
    CONFIG: CONFIG
  };
```

- [ ] **Step 5: Manually verify nothing regressed**

Serve locally: `python3 -m http.server 8099 --bind 0.0.0.0` and open `http://pc-bp3-wsl:8099`.
In the browser console:
- `window.RenAiko` is defined with the listed methods.
- Log in with the `Brian` password (`DreamBoy`); existing sections still load (Posts/Timeline/Feedback). No console errors.
- `window.__dashboardReady === true` after login.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat(app): RenAiko bridge, dashboard:ready event, generalized announcements

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 6: HTML — nav, section, modals

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces (DOM ids used by `our-world.js`/`app.js`): nav link `[data-section="our-world-section"]`; `#our-world-section`, `#ow-progress`, `#ow-toggle-us`, `#ow-add-dest-btn`, `#globe-wrap`, `#globe-canvas`, `#us-inset`; modal `#ow-dest-modal` with `#ow-dest-form`, `#ow-dest-name`, `#ow-dest-status`; announcement modal `#announce-globe-modal` with `#announce-globe-btn`.

- [ ] **Step 1: Add the nav link**

In `<nav class="header-nav">`, add after the Feedback link:

```html
        <a href="#our-world-section" class="nav-link" data-section="our-world-section">Our World</a>
```

- [ ] **Step 2: Add the Our World section**

After the closing `</section>` of `#feedback-section` (before `#archive-section`), add:

```html
    <!-- Our World -->
    <section id="our-world-section" class="section hidden">
      <div class="section-top">
        <h2 class="section-title">Our World</h2>
        <button id="ow-add-dest-btn" class="action-btn">+ Add Destination</button>
      </div>
      <p id="ow-progress" class="ow-progress">— / 50 states &middot; — / — countries</p>
      <div class="ow-controls">
        <button id="ow-toggle-us" class="ow-toggle" type="button">Zoom to US states</button>
      </div>
      <div id="globe-wrap" class="globe-wrap">
        <div id="globe-canvas" class="globe-canvas"></div>
      </div>
      <div id="us-inset" class="us-inset hidden"></div>
    </section>
```

- [ ] **Step 3: Add the add-destination modal**

In the MODALS area (e.g., after the Feedback Modal), add:

```html
  <!-- Add Destination Modal -->
  <div id="ow-dest-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>Add a Destination</h3>
        <button class="modal-x" data-close="ow-dest-modal">&times;</button>
      </div>
      <form id="ow-dest-form">
        <label class="form-label">Place name
          <input type="text" id="ow-dest-name" class="form-input" placeholder="e.g. Paris, Banff, Tokyo" autocomplete="off" required>
        </label>
        <p id="ow-dest-status" class="form-hint"></p>
        <button type="submit" class="form-submit">Add to map</button>
      </form>
    </div>
  </div>
```

- [ ] **Step 4: Add the globe announcement modal**

After the existing Announcement Modal (`#announce-modal`), add:

```html
  <!-- Globe Announcement Modal (one-time, Linh only) -->
  <div id="announce-globe-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>New: Our World &#127757;</h3>
        <button class="modal-x" data-close="announce-globe-modal">&times;</button>
      </div>
      <div class="announce-body">
        <p>There's a new interactive globe in the dashboard.</p>
        <p>&#128506;&#65039; <strong>Tap the places we've been</strong> &mdash; every country and all 50 US states. The ones we haven't reached yet will glow, waiting for us.</p>
        <p>&#128205; <strong>Add dream destinations</strong> &mdash; type a place and it drops a pin on the map. Our bucket list: all 50 states and every country.</p>
        <button type="button" class="form-submit" id="announce-globe-btn">Explore it &rarr;</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 5: Manually verify markup**

Serve locally (`python3 -m http.server 8099 --bind 0.0.0.0`, open `http://pc-bp3-wsl:8099`), log in, click **Our World** in the nav: the section toggles open showing the title, progress line, "Zoom to US states" button, and an empty globe container. Clicking **+ Add Destination** does nothing yet (wired in Task 9) — that's expected. No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): Our World section, add-destination + globe announcement modals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 7: `globe-view.js` (globe.gl globe, browser-only)

**Files:**
- Create: `js/globe-view.js`

**Interfaces:**
- Consumes: globe.gl (pinned ESM CDN); a `countries` GeoJSON FeatureCollection (features have `properties.code`).
- Produces: `createGlobeView(container, opts) -> { refresh(), focusUS(), resize(), destroy() }` where `opts = { countries, getVisited:()=>Set, getDestinations:()=>place[], onRegionClick:(code)=>void, onPinClick:(place)=>void }`.

- [ ] **Step 1: Spike — verify globe.gl resolves and its API matches**

Before writing the module (everything visual depends on these accessors),
confirm the pinned library loads and behaves as assumed. Create a throwaway
`globe-spike.html` at repo root:

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0a0a0f}#g{width:100vw;height:100vh}</style></head>
<body><div id="g"></div><script type="module">
import Globe from 'https://esm.sh/globe.gl@2.46.1';
const countries = await fetch('data/countries-110m.geojson').then(r=>r.json());
const w = Globe()(document.getElementById('g'))
  .backgroundColor('#0a0a0f')
  .polygonsData(countries.features)
  .polygonCapColor(()=> 'rgba(245,230,211,0.3)')
  .onPolygonClick(f=>console.log('click', f.properties.code))
  .htmlElementsData([{lat:48.85,lng:2.35}])
  .htmlLat(d=>d.lat).htmlLng(d=>d.lng)
  .htmlElement(()=>{const e=document.createElement('div');e.textContent='📍';return e;});
console.log('controls?', typeof w.controls === 'function');
</script></body></html>
```

Serve (`python3 -m http.server 8099 --bind 0.0.0.0`) and open
`http://pc-bp3-wsl:8099/globe-spike.html`. Confirm, before proceeding: **no
import/network error** (the pinned version resolves), countries render, clicking
a country logs its code, the 📍 pin appears, and the console logs `controls? true`.
If any accessor is renamed/missing in this version, adjust the next step's code to
match. Then **delete `globe-spike.html`**.

- [ ] **Step 2: Write `js/globe-view.js`**

```js
// Themed globe.gl globe: clickable country polygons (glow when unvisited),
// destination pins, gentle auto-rotate. Browser-only (imports globe.gl).
import Globe from 'https://esm.sh/globe.gl@2.46.1';

const THEME = {
  bg: '#0a0a0f',
  visited: 'rgba(199,130,175,0.85)', // solid mauve
  stroke: 'rgba(245,230,211,0.35)',  // cream outline
  atmosphere: '#c782af'
};

// 1x1 dark-mauve PNG -> uniform dark sphere (polygons + atmosphere carry the color).
const DARK_TEX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export function createGlobeView(container, opts) {
  const { countries, getVisited, getDestinations, onRegionClick, onPinClick } = opts;
  const codeOf = f => (f.properties && f.properties.code) || '';

  // pulse drives the unvisited glow; throttled re-eval keeps mobile smooth.
  let pulse = 0;
  function capColor(f) {
    if (getVisited().has(codeOf(f))) return THEME.visited;
    const a = (0.10 + pulse * 0.30).toFixed(3); // 0.10..0.40 cream glow
    return `rgba(245,230,211,${a})`;
  }

  function pinEl(d) {
    const el = document.createElement('div');
    el.className = 'globe-pin ' + (d.status === 'visited' ? 'visited' : 'wish');
    el.title = d.name + (d.status === 'visited' ? ' (visited)' : ' (wishlist)');
    el.addEventListener('click', e => { e.stopPropagation(); onPinClick(d); });
    return el;
  }

  const world = Globe()(container)
    .backgroundColor(THEME.bg)
    .globeImageUrl(DARK_TEX)
    .showAtmosphere(true)
    .atmosphereColor(THEME.atmosphere)
    .atmosphereAltitude(0.18)
    .polygonsData(countries.features)
    .polygonAltitude(0.012)
    .polygonCapColor(capColor)
    .polygonSideColor(() => 'rgba(199,130,175,0.06)')
    .polygonStrokeColor(() => THEME.stroke)
    .polygonsTransitionDuration(0) // 0: the glow re-applies cap colors ~12fps; a tween here would never finish and the pulse would look laggy/flat
    .onPolygonClick(f => onRegionClick(codeOf(f)))
    .htmlElementsData(getDestinations())
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.02)
    .htmlElement(pinEl);

  world.width(container.clientWidth).height(container.clientHeight || 420);

  const ctrls = world.controls();
  ctrls.autoRotate = true;
  ctrls.autoRotateSpeed = 0.6;
  container.addEventListener('pointerdown', () => { ctrls.autoRotate = false; });

  // lean: re-eval cap colors ~12fps for the glow pulse — cheap enough for ~177
  // polygons; drop to a setInterval at lower rate if a weak device struggles.
  let last = 0, raf;
  function animate(t) {
    if (t - last > 80) {
      pulse = (Math.sin(t / 700) + 1) / 2;
      world.polygonCapColor(capColor);
      last = t;
    }
    raf = requestAnimationFrame(animate);
  }
  raf = requestAnimationFrame(animate);

  return {
    refresh() {
      world.polygonCapColor(capColor);
      world.htmlElementsData(getDestinations());
    },
    focusUS() {
      world.pointOfView({ lat: 39.8, lng: -98.6, altitude: 1.6 }, 900);
    },
    resize() {
      world.width(container.clientWidth).height(container.clientHeight || 420);
    },
    destroy() { cancelAnimationFrame(raf); }
  };
}
```

- [ ] **Step 3: Manual smoke check (standalone)**

Create a throwaway `globe-test.html` at repo root (delete after):

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0a0a0f}#g{width:100vw;height:100vh}</style></head>
<body><div id="g"></div><script type="module">
import { createGlobeView } from './js/globe-view.js';
const countries = await fetch('data/countries-110m.geojson').then(r=>r.json());
const visited = new Set(['FR','JP']);
createGlobeView(document.getElementById('g'), {
  countries, getVisited:()=>visited, getDestinations:()=>[{name:'Paris',lat:48.85,lng:2.35,status:'wish'}],
  onRegionClick:c=>console.log('region',c), onPinClick:d=>console.log('pin',d.name)
});
</script></body></html>
```

Serve (`python3 -m http.server 8099 --bind 0.0.0.0`), open `http://pc-bp3-wsl:8099/globe-test.html`. Verify: a dark globe with rose atmosphere auto-rotates; France/Japan render solid mauve, others glow/pulse cream; clicking a country logs its code; a pin shows near Paris and logs on click. Then **delete `globe-test.html`**.

- [ ] **Step 4: Commit**

```bash
git add js/globe-view.js
git commit -m "feat(globe): themed globe.gl view with glow polygons + pins

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 8: `us-inset.js` (SVG US drill-in, browser-only)

**Files:**
- Create: `js/us-inset.js`

**Interfaces:**
- Consumes: `data/us-states.svg` (fetched).
- Produces: `createUsInset(container, opts) -> { refresh() }` where `opts = { getVisited:()=>Set, onStateClick:(code)=>void }`. Injects the SVG, toggles `.visited`/`.unvisited` classes on `path[data-code]`, and calls `onStateClick` with the `US-XX` code.

- [ ] **Step 1: Write `js/us-inset.js`**

```js
// Flat SVG US map drill-in. Loads data/us-states.svg, wires state clicks,
// and reflects visited state via CSS classes. Browser-only.
export async function createUsInset(container, opts) {
  const { getVisited, onStateClick } = opts;
  const res = await fetch('data/us-states.svg');
  container.innerHTML = await res.text();
  const svg = container.querySelector('svg');
  if (!svg) return { refresh() {} };

  svg.addEventListener('click', e => {
    const path = e.target.closest('path[data-code]');
    if (!path) return;
    onStateClick(path.getAttribute('data-code'));
  });

  function refresh() {
    const visited = getVisited();
    svg.querySelectorAll('path[data-code]').forEach(p => {
      const v = visited.has(p.getAttribute('data-code'));
      p.classList.toggle('visited', v);
      p.classList.toggle('unvisited', !v);
    });
  }

  refresh();
  return { refresh };
}
```

- [ ] **Step 2: Manual smoke check (standalone)**

Create throwaway `inset-test.html` at repo root:

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{background:#0a0a0f}.us-map{width:80vw}
.us-map path{stroke:#0a0a0f;stroke-width:1}
.us-map path.unvisited{fill:#2a1f3d}
.us-map path.visited{fill:#c782af}</style></head>
<body><div id="i"></div><script type="module">
import { createUsInset } from './js/us-inset.js';
const visited = new Set(['US-CA','US-TX']);
await createUsInset(document.getElementById('i'), {
  getVisited:()=>visited,
  onStateClick:c=>{ if(visited.has(c))visited.delete(c); else visited.add(c);
    document.querySelector('#i').__r(); console.log('toggle',c); }
});
</script></body></html>
```

Serve and open `http://pc-bp3-wsl:8099/inset-test.html`. Verify: US map renders with 50 states; CA & TX filled mauve, rest dark; clicking a state logs its `US-XX` code. (The toggle won't re-color here because `refresh` isn't exposed on the DOM node — that's fine; clicking + logging the right code is what we're checking.) Then **delete `inset-test.html`**.

- [ ] **Step 3: Commit**

```bash
git add js/us-inset.js
git commit -m "feat(globe): SVG US states drill-in inset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 9: `our-world.js` (wiring) + module script tag

**Files:**
- Create: `js/our-world.js`
- Modify: `index.html` (add the module `<script>` at the end of `<body>`, after `app.js`)

**Interfaces:**
- Consumes: `window.RenAiko` (Task 5), `js/places-model.js`, `js/place-lookup.js`, `js/globe-view.js`, `js/us-inset.js`, and the DOM ids from Task 6; data files from Task 1.
- Produces: the live feature — region/state toggles, destination add + pin toggle, progress readout, lazy globe init, US inset toggle.

- [ ] **Step 1: Write `js/our-world.js`**

```js
// Our World feature wiring: loads places + data, renders the globe, the US
// inset, the progress readout, and handles region/destination toggles and the
// add-destination flow. Browser-only; talks to the backend via window.RenAiko.
import { createGlobeView } from './globe-view.js';
import { createUsInset } from './us-inset.js';
import { lookup } from './place-lookup.js';
import * as model from './places-model.js';

const API = () => window.RenAiko;

let places = [];
let cities = [];
let countries = null;
let globe = null;
let inset = null;
let booted = false;

const visited = () => model.visitedRegionSet(places);
const destinations = () => model.destinationPlaces(places);

// Sheets returns numbers as strings; coerce destination lat/lng so globe.gl's
// sphere math (htmlLat/htmlLng) gets real numbers, not NaN, after a refetch.
function normalizePlaces(rows) {
  return (Array.isArray(rows) ? rows : []).map(p => {
    if (p && p.kind === 'destination') {
      return Object.assign({}, p, { lat: Number(p.lat), lng: Number(p.lng) });
    }
    return p;
  });
}

async function fetchPlaces() {
  const a = API();
  if (!a) return places;
  const rows = await a.apiGet('getPlaces').catch(() => null);
  return rows ? normalizePlaces(rows) : places;
}

async function boot() {
  if (booted) return;
  booted = true;

  const a = API();
  const [placesData, citiesData, countriesData] = await Promise.all([
    a ? a.apiGet('getPlaces').catch(() => []) : Promise.resolve([]),
    fetch('data/cities.json').then(r => r.json()).catch(() => []),
    fetch('data/countries-110m.geojson').then(r => r.json()).catch(() => null)
  ]);
  places = normalizePlaces(placesData);
  cities = citiesData || [];
  countries = countriesData;

  try {
    inset = await createUsInset(document.getElementById('us-inset'), {
      getVisited: visited,
      onStateClick: onRegionToggle
    });
  } catch (e) { /* inset optional */ }

  updateProgress();
  initAddDestination();
  initInsetToggle();
  initReveal();
}

function ensureGlobe() {
  if (globe || !countries) return;
  const el = document.getElementById('globe-canvas');
  if (!el) return;
  try {
    globe = createGlobeView(el, {
      countries,
      getVisited: visited,
      getDestinations: destinations,
      onRegionClick: onRegionToggle,
      onPinClick: onPinToggle
    });
    window.addEventListener('resize', () => globe && globe.resize());
  } catch (e) {
    el.innerHTML = '<p class="ow-fallback">Globe couldn’t load — the US map and wishlist still work.</p>';
  }
}

async function onRegionToggle(code) {
  const a = API();
  const act = model.toggleRegionAction(places, code);
  // optimistic update
  if (act.action === 'add') {
    places.push({ id: 'tmp-' + code, kind: 'region', code });
  } else {
    places = places.filter(p => p.id !== act.id);
  }
  refreshAll();
  if (!a) return;
  const user = a.getCookie(a.CONFIG.USER_COOKIE) || '';
  try {
    if (act.action === 'add') {
      await a.apiPost({ action: 'addPlace', kind: 'region', code, name: code, user });
    } else {
      await a.apiPost({ action: 'deleteEntry', sheet: 'Places', id: act.id });
    }
  } catch (e) { /* reconcile below */ }
  places = await fetchPlaces();
  refreshAll();
}

async function onPinToggle(d) {
  const a = API();
  d.status = model.nextDestinationStatus(d.status);
  refreshAll();
  if (!a || !d.id || String(d.id).startsWith('tmp')) return;
  try {
    await a.apiPost({ action: 'editEntry', sheet: 'Places', id: d.id, status: d.status });
  } catch (e) { /* best-effort */ }
}

function refreshAll() {
  if (globe) globe.refresh();
  if (inset) inset.refresh();
  updateProgress();
}

function updateProgress() {
  const totalCountries = (countries && countries.features) ? countries.features.length : 195;
  const p = model.progress(places, 50, totalCountries);
  const el = document.getElementById('ow-progress');
  if (el) {
    el.textContent =
      `${p.states.visited} / ${p.states.total} states · ` +
      `${p.countries.visited} / ${p.countries.total} countries`;
  }
}

function initInsetToggle() {
  const btn = document.getElementById('ow-toggle-us');
  const insetEl = document.getElementById('us-inset');
  const globeEl = document.getElementById('globe-wrap');
  if (!btn || !insetEl || !globeEl) return;
  btn.addEventListener('click', () => {
    const showInset = insetEl.classList.contains('hidden');
    insetEl.classList.toggle('hidden', !showInset);
    globeEl.classList.toggle('hidden', showInset);
    btn.textContent = showInset ? '← Back to globe' : 'Zoom to US states';
    if (!showInset) ensureGlobe();
  });
}

function initAddDestination() {
  const openBtn = document.getElementById('ow-add-dest-btn');
  const form = document.getElementById('ow-dest-form');
  const input = document.getElementById('ow-dest-name');
  const status = document.getElementById('ow-dest-status');
  const a = API();

  if (openBtn && a) {
    openBtn.addEventListener('click', () => {
      if (status) status.textContent = '';
      a.openModal('ow-dest-modal');
    });
  }
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const hit = lookup(input.value, cities);
    if (!hit) {
      if (status) status.textContent = 'Place not found — try a nearby major city.';
      return;
    }
    // optimistic pin
    const tmp = { id: 'tmp-dest', kind: 'destination', name: hit.name, lat: hit.lat, lng: hit.lng, status: 'wish' };
    places.push(tmp);
    refreshAll();
    if (a) {
      const user = a.getCookie(a.CONFIG.USER_COOKIE) || '';
      try {
        await a.apiPost({
          action: 'addPlace', kind: 'destination',
          name: hit.name, lat: hit.lat, lng: hit.lng, status: 'wish', user
        });
      } catch (e2) { /* reconcile below */ }
      places = await fetchPlaces();
      refreshAll();
      a.closeModal('ow-dest-modal');
    }
    form.reset();
  });
}

// Lazy-init the globe the first time the section is opened (saves WebGL cost).
function initReveal() {
  const link = document.querySelector('.nav-link[data-section="our-world-section"]');
  const section = document.getElementById('our-world-section');
  if (link) link.addEventListener('click', () => setTimeout(ensureGlobe, 60));
  // If already visible on load, init now.
  if (section && !section.classList.contains('hidden')) ensureGlobe();
}

document.addEventListener('dashboard:ready', boot);
// Fallback if the event already fired before this module attached its listener.
if (window.__dashboardReady) boot();
```

- [ ] **Step 2: Add the module script tag**

In `index.html`, immediately after `<script src="app.js"></script>`, add:

```html
  <script type="module" src="js/our-world.js"></script>
```

- [ ] **Step 3: Manual end-to-end verification**

Serve (`python3 -m http.server 8099 --bind 0.0.0.0`), open `http://pc-bp3-wsl:8099`, log in (`DreamBoy` → Brian). Then:
- Open **Our World**: globe appears and auto-rotates; progress shows `0 / 50 states · 0 / NNN countries`.
- Click a country on the globe → it turns solid mauve; progress country count increments; reload the page → it stays visited (persisted). Click again → reverts.
- Click **Zoom to US states** → US map shows; click a state → fills mauve; progress state count increments; persists across reload.
- **+ Add Destination** → type `Paris` → submit → a pin appears near Paris; reload → pin persists. Click the pin → toggles wish/visited styling.
- Type a nonsense place → "Place not found" message, no crash.

- [ ] **Step 4: Commit**

```bash
git add js/our-world.js index.html
git commit -m "feat(globe): wire Our World (toggles, pins, progress, lazy globe)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Task 10: `style.css` (theme polish — frontend-design)

**Files:**
- Modify: `style.css`

**Interfaces:**
- Consumes: DOM/classes from Tasks 6–9 (`.ow-progress`, `.ow-controls`, `.ow-toggle`, `.globe-wrap`, `.globe-canvas`, `.us-map`, `.globe-pin`, `.form-hint`, `.ow-fallback`).
- Produces: themed, responsive styling.

> Use the **frontend-design** skill while implementing this task to push visual quality (cohesion with the gate/title gradient, motion, depth). The CSS below is a complete, correct baseline — refine, don't regress.

- [ ] **Step 1: Append the Our World styles to `style.css`**

```css
/* ===========================
   Our World — globe + map
   =========================== */
.ow-progress {
  font-size: 14px;
  letter-spacing: 0.5px;
  color: #c782af;
  margin: 4px 0 12px;
}
.ow-controls { margin-bottom: 12px; }
.ow-toggle {
  background: rgba(199, 130, 175, 0.12);
  border: 1px solid #2a1f3d;
  color: #e8e4df;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.ow-toggle:hover { background: rgba(199, 130, 175, 0.22); border-color: #c782af; }

.globe-wrap, .us-inset {
  position: relative;
  width: 100%;
  border: 1px solid #2a1f3d;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(120% 120% at 50% 0%, rgba(199,130,175,0.10), transparent 60%),
    #07070b;
  box-shadow: 0 0 40px rgba(199, 130, 175, 0.12);
}
.globe-canvas { width: 100%; height: 60vh; min-height: 360px; }

/* US drill-in map */
.us-inset { padding: 18px; }
.us-map { width: 100%; height: auto; display: block; }
.us-map path {
  stroke: #0a0a0f;
  stroke-width: 0.75;
  cursor: pointer;
  transition: fill 0.25s ease, filter 0.25s ease;
}
.us-map path.unvisited {
  fill: rgba(199, 130, 175, 0.14);
  filter: drop-shadow(0 0 2px rgba(245, 230, 211, 0.25));
  animation: owGlow 2.8s ease-in-out infinite;
}
.us-map path.visited {
  fill: #c782af;
  filter: drop-shadow(0 0 6px rgba(199, 130, 175, 0.6));
  animation: none;
}
.us-map path:hover { fill: rgba(245, 230, 211, 0.55); }

@keyframes owGlow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(245, 230, 211, 0.20)); }
  50%      { filter: drop-shadow(0 0 7px rgba(245, 230, 211, 0.55)); }
}

/* Destination pins (globe.gl htmlElements) */
.globe-pin {
  width: 14px; height: 14px;
  border-radius: 50%;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: transform 0.15s ease;
}
.globe-pin.wish {
  background: transparent;
  border: 2px solid #f5e6d3;
  box-shadow: 0 0 8px rgba(245, 230, 211, 0.7);
  animation: owGlow 2.4s ease-in-out infinite;
}
.globe-pin.visited {
  background: #c782af;
  border: 2px solid #f5e6d3;
  box-shadow: 0 0 10px rgba(199, 130, 175, 0.9);
}
.globe-pin:hover { transform: translate(-50%, -50%) scale(1.35); }

.form-hint { font-size: 12px; color: #c782af; min-height: 16px; margin: 4px 0 8px; }
.ow-fallback { padding: 32px; text-align: center; color: #b8b0a8; }

@media (max-width: 600px) {
  .globe-canvas { height: 52vh; min-height: 300px; }
}
```

- [ ] **Step 2: Manual visual verification**

Serve and open on desktop (`http://pc-bp3-wsl:8099`) and a phone on the tailnet. Confirm: globe sits in a rounded glowing card matching the site; unvisited US states pulse/glow, visited are solid mauve; pins read clearly (outline = wishlist, filled = visited); the add-destination modal matches the other modals; layout holds on mobile. Tune values with the frontend-design skill if anything looks generic or off-theme.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style(globe): theme Our World globe, US map, pins, glow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FiqVeRZgwkgUixGcH2gFap"
```

---

## Final verification (whole feature)

- [ ] Run `npm test` → all unit + data tests pass.
- [ ] As **Linh** (password `DreamGirl`) in a fresh browser (no `ren-aiko-seen-globe` cookie): on login the **globe announcement** shows once; "Explore it →" opens Our World; reload → announcement does **not** reappear.
- [ ] As **Brian**: no announcement; full globe/inset/destination flow works and persists.
- [ ] globe.gl fallback: block the CDN (devtools offline or bad URL) → globe area shows the fallback message; US inset + wishlist still function.
- [ ] Merge `feature/our-world-globe` → `main` (per existing workflow) once verified.

---

## Self-Review (completed by author)

- **Spec coverage:** rendering (globe.gl + SVG inset) → T1/T6/T7/T8; states+all countries → T1 data + T7/T8; type-name auto-pin → T3 + T9; shared persistence + Places sheet → T4; announcement (Linh-only, no re-login) → T5/T6; points-on-visit (`place`) → T4; progress readout → T2/T9; error handling (globe fallback, optimistic+reconcile) → T7/T9; testing strategy → T1–T3 automated, T4/T6–T10 manual. All covered.
- **Placeholder scan:** no TBD/TODO; every code step has complete code; throwaway smoke-test files are explicitly deleted.
- **Type consistency:** `visited` is always a `Set` of normalized codes; `place` shape consistent; `createGlobeView`/`createUsInset`/`lookup`/`model.*` signatures match between definition (T2/T3/T7/T8) and use (T9); `window.RenAiko` surface defined in T5 matches usage in T9; region codes `US-XX` / alpha-2 consistent across T1 data build, T2 model, T4 backend, T7/T8 views.
