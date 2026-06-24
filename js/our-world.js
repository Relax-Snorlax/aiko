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
let countryAliases = null;
// Per-key guards so a rapid second click on the SAME region/pin can't race its
// own in-flight network op (duplicate rows / deleting a not-yet-saved row).
const inFlightRegions = new Set();
const inFlightPins = new Set();

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
  const [placesData, citiesData, countriesData, aliasesData] = await Promise.all([
    a ? a.apiGet('getPlaces').catch(() => []) : Promise.resolve([]),
    fetch('data/cities.json').then(r => r.json()).catch(() => []),
    fetch('data/countries-110m.geojson').then(r => r.json()).catch(() => null),
    fetch('data/country-codes.json').then(r => r.json()).catch(() => null)
  ]);
  places = normalizePlaces(placesData);
  cities = citiesData || [];
  countries = countriesData;
  countryAliases = aliasesData;

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
    el.innerHTML = '<p class="ow-fallback">Globe couldn\'t load — the US map and wishlist still work.</p>';
  }
}

async function onRegionToggle(code) {
  const a = API();
  const act = model.toggleRegionAction(places, code);
  // Ignore a second click on the SAME region while its op is in flight.
  if (inFlightRegions.has(act.code)) return;
  inFlightRegions.add(act.code);
  // optimistic update — use the normalized code from the action so persisted
  // data stays canonical (US-CA, FR), not whatever case the layer reported
  if (act.action === 'add') {
    places.push({ id: 'tmp-' + act.code, kind: 'region', code: act.code });
  } else {
    places = places.filter(p => p.id !== act.id);
  }
  refreshAll();
  try {
    if (!a) return;
    const user = a.getCookie(a.CONFIG.USER_COOKIE) || '';
    try {
      if (act.action === 'add') {
        await a.apiPost({ action: 'addPlace', kind: 'region', code: act.code, name: act.code, user });
      } else {
        await a.apiPost({ action: 'deleteEntry', sheet: 'Places', id: act.id });
      }
    } catch (e) { /* reconcile below */ }
    places = await fetchPlaces();
    refreshAll();
  } finally {
    inFlightRegions.delete(act.code);
  }
}

async function onPinToggle(d) {
  const a = API();
  const persistable = !!(a && d.id && !String(d.id).startsWith('tmp'));
  // Ignore a double-click on the same saved pin while its edit is in flight.
  if (persistable && inFlightPins.has(d.id)) return;
  d.status = model.nextDestinationStatus(d.status);
  refreshAll();
  if (!persistable) return;
  inFlightPins.add(d.id);
  try {
    await a.apiPost({ action: 'editEntry', sheet: 'Places', id: d.id, status: d.status });
  } catch (e) { /* best-effort */ } finally {
    inFlightPins.delete(d.id);
  }
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
    const showInset = insetEl.classList.contains('hidden'); // true = switching TO the inset
    insetEl.classList.toggle('hidden', !showInset);
    globeEl.classList.toggle('hidden', showInset);
    btn.textContent = showInset ? '← Back to globe' : 'Zoom to US states';
    if (!showInset) ensureGlobe(); // returning to the globe → make sure it exists
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
    const hit = lookup(input.value, cities, countryAliases);
    if (!hit) {
      if (status) status.textContent = 'Place not found — try a nearby major city.';
      return;
    }
    // optimistic pin
    const tmp = { id: 'tmp-dest-' + Date.now(), kind: 'destination', name: hit.name, lat: hit.lat, lng: hit.lng, status: 'wish' };
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
      form.reset();
    }
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
