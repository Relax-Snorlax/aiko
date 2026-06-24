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
 * qualifier: an alpha-2 code ("Paris, FR") matches directly, and a full name
 * ("Paris, France") matches when a normalized name->code `countryAliases` map
 * is supplied. An unresolved qualifier is ignored (falls back to best name
 * match) rather than failing. Returns { name, lat, lng, country } or null.
 */
export function lookup(query, cities, countryAliases) {
  const raw = String(query || '').trim();
  if (!raw || !Array.isArray(cities) || !cities.length) return null;

  let namePart = raw, countryPart = '';
  const comma = raw.lastIndexOf(',');
  if (comma > -1) {
    namePart = raw.slice(0, comma);
    countryPart = normalizeName(raw.slice(comma + 1));
    // Resolve a full country name to its alpha-2 code if a map is provided.
    if (countryPart && countryAliases && countryAliases[countryPart]) {
      countryPart = normalizeName(countryAliases[countryPart]);
    }
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
