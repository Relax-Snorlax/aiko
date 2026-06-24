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
