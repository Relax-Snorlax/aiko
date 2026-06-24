# Our World — Interactive Globe & Visited-Places Map

**Date:** 2026-06-24
**Site:** linhyeh.brianpham.us (Ren & Aiko private dashboard)
**Status:** Approved design — ready for implementation plan

## Summary

Add a new **"Our World"** section: an interactive 3D globe that doubles as a
shared travel checklist for the couple. Every country and every US state is a
clickable region — unvisited regions **glow** to invite a click; clicking marks
the place **visited**. Linh can also add **wishlist destinations** (points of
interest) by name, which drop a glowing pin on the map; clicking a pin toggles it
visited. A one-time announcement introduces the feature to Linh on login.

Two bucket-list goals drive the design: visit **all 50 US states** and **every
country**.

## Goals

- A visually striking, theme-matched, highly interactive globe (manga / dark
  rose-mauve aesthetic) built with the frontend-design skill.
- Click any **country** (on the globe) or **US state** (in a drill-in view) to
  toggle visited; unvisited glows, visited is calm/filled.
- Add **wishlist destinations** by typing a name → auto-pin at resolved
  coordinates; click a pin to toggle visited.
- Persist a **single shared map** for the couple via the existing Apps Script +
  Sheets backend.
- Introduce the feature with a **one-time announcement** shown only to Linh.

## Non-Goals

- Per-user separate maps (it is one shared "we've been" map).
- Editing region geometry or adding custom regions beyond countries + US states.
- A live geocoding API. Destination lookup uses a bundled static dataset.
- Routes/trip planning, photos-on-map, or date-of-visit tracking (future).

## Rendering Approach

**Chosen: `globe.gl` WebGL globe + flat inline-SVG US inset.**

- **Hero globe:** `globe.gl` (thin three.js wrapper), loaded as a **version-pinned
  ES module from a CDN**. Provides clickable country polygons, hover/glow,
  auto-rotate, drag-to-spin, and a tintable atmosphere — so we write behavior,
  not a 3D engine.
- **Geometry vendored locally:** world-atlas (countries TopoJSON) and us-atlas
  (US states TopoJSON) are public domain and **committed into the repo** so the
  map geometry never depends on a runtime CDN. Only the library loads from CDN.
- **US states drill-in:** tapping the United States reveals a flat inline-SVG US
  map (albersUSA projection). 50 `<path>` states are easily tappable on a phone
  and styled entirely with the site's existing CSS glow/breathe language. This is
  the deliberate fix for 50 tiny states being untappable on a sphere.

**Trade-off accepted:** this adds three.js/globe.gl (~150 kB gz) via CDN, which
breaks the site's zero-dependency ethos. Justified by the explicit "globe +
frontend-design" requirement (user instruction outranks the lean default). Cost
contained by vendoring all geo data locally and pinning the library version. The
site already requires internet for the Sheets backend, so a CDN script adds no
new offline failure mode beyond the library itself (which degrades gracefully —
see Error Handling).

**Alternatives considered:**
- *D3 orthographic SVG globe* — all-SVG, lighter, 100% CSS-themed, but flatter
  with no true 3D atmosphere.
- *Hand-rolled vanilla globe* — maximum bloat-avoidance, but reinvents
  projection + hit-testing; too slow at this polish bar.

## Architecture

The site is a zero-build static app (`index.html` + vanilla `app.js` IIFE +
`style.css`) on GitHub Pages, with a Google Apps Script + Sheets backend. The
feature follows existing patterns: a new nav section, a new sheet + two backend
actions, and new front-end modules that reuse the existing API/modal/loader
conventions.

### Components (isolated, each with one purpose)

1. **`places-api`** — read/add/toggle/remove places against the backend. Mirrors
   the existing `apiGet`/`apiPost` layer. Interface: `getPlaces()`,
   `addRegion(code,name,user)`, `addDestination(name,lat,lng,user)`,
   `setStatus(id,status)`, `removePlace(id)`.
2. **`place-lookup`** — **pure** function `lookup(name) -> {lat,lng,label} | null`
   against a bundled JSON of ~1,000 world cities + national capitals. No API key,
   works offline. Independently unit-testable.
3. **`globe-view`** — globe.gl setup: country polygons, visited/unvisited
   styling, destination pins, click handlers, auto-rotate. Interface:
   `init(container)`, `render(places)`, `onRegionToggle(cb)`, `onPinToggle(cb)`.
4. **`us-inset`** — inline-SVG US map: state click → toggle. Interface:
   `render(places)`, `onStateToggle(cb)`, `show()/hide()`.
5. **`our-world` section** — wires the above together, owns the add-destination
   modal (reusing existing modal markup pattern) and the progress readout.

### Data Model — new `Places` sheet

Columns: `id, date, kind, code, name, lat, lng, status, added_by, notes`

- **Region row** (`kind = "region"`): one row per **visited** state or country.
  `code` = `US-CA`, `FR`, etc. (ISO-3166 country codes; `US-XX` for states).
  Presence of a row = visited. **Absence = unvisited = glowing.** Toggling a
  region off **deletes** the row. `lat`/`lng` empty.
- **Destination row** (`kind = "destination"`): a wishlist pin. `name` = "Paris",
  `lat`/`lng` from `place-lookup` at add-time, `status` = `"wish"` → `"visited"`
  (click toggles via `editEntry`). `code` empty.
- **Shared:** one map for the couple. `added_by` records who toggled (audit only,
  not used for filtering).

### Backend changes (Apps Script `Code.gs`)

- Add `'Places'` to `EDITABLE_SHEETS` with allowlist
  `['kind','code','name','lat','lng','status','added_by','notes']` so the generic
  `editEntry` (status toggle) and `deleteEntry` (region-off / destination remove)
  work unchanged.
- Add `getPlaces` to the `doGet` switch → `sheetToObjects('Places')` via
  `ensureSheet('Places', PLACES_HEADERS)`.
- Add `addPlace` to the `doPost` switch → validates `kind`, appends a row with a
  UUID + ISO date, awards points (see below). Returns `{success, id}`.
- New constant `PLACES_HEADERS`. No new patterns introduced.

## Data Flow

**Load:** `loadOurWorld()` (called from `loadDashboard`) → `getPlaces()` →
split into visited region codes (Set) + destinations → `globe-view.render()` +
`us-inset.render()` + update progress readout.

**Toggle a region:** click country/state → if currently unvisited, `addRegion()`
(creates row); if visited, `removePlace(id)` (deletes row) → optimistic UI update
→ refetch on settle to confirm (same resilience pattern as existing forms).

**Add a destination:** open modal → type name → `place-lookup(name)`; on match,
preview the pin location; on no match, prompt tap-to-drop on the map → submit →
`addDestination()` → pin appears (wishlist style).

**Toggle a destination:** click pin → `setStatus(id, visited|wish)` → restyle.

## Interaction & Visual Design (frontend-design at build time)

- **Unvisited** region: animated rose/mauve **glow** reusing the existing
  `glowNew` / `tierBreathe` keyframe language — signals "click me." **Visited**:
  solid mauve fill, calm, soft check accent.
- **Globe:** dark sphere, **rose-tinted atmosphere**, gentle auto-rotate that
  pauses on user interaction; cream→mauve gradient accents matching the gate/title
  (`#f5e6d3 → #c782af`, bg `#0a0a0f`, borders `#2a1f3d`).
- **Pins:** glowing HTML markers; wishlist = outline pulse, visited = filled.
- **Progress readout:** "12 / 50 states · 7 / 195 countries" styled like the
  stats footer.
- **US inset:** smooth reveal (slide/fade) below or over the globe; a clear "Back
  to globe" affordance.
- Mobile-first: globe drag + pinch; inset states large enough to tap.

## Announcement (one-time, Linh only)

- Reuses the existing one-time-modal pattern. New cookie
  `ren-aiko-seen-globe`. Shown **only to Linh, once**, on login via the existing
  `maybeShowAnnouncement` path (generalized to show **at most one** unseen
  announcement per load; the globe announcement takes priority now).
- **No forced re-login** (unlike the rate/points announcement). Linh already has a
  user cookie; the map works without it (only point-awards need it). Primary
  button: **"Explore it →"** closes the modal and opens the Our World section.
- Copy (draft): introduces the interactive globe — click states/countries you've
  been to, watch the rest glow, and add dream destinations as pins. Final copy in
  implementation.

## Points Integration

Marking a place visited awards points via a new `action_type = "place"` through
the existing `awardPointsIfEligible` (3-hour cooldown per action type applies, so
bulk-clicking many regions in one sitting yields one award — acceptable). Keeps
the feature consistent with the site's gamification.

## Error Handling

- **globe.gl fails to load** (CDN/network): show a themed fallback message in the
  globe container; the **US inset and wishlist list remain functional** (they are
  SVG/DOM, no WebGL). Detect via module load `.catch` / timeout.
- **Backend read/write failures:** reuse the existing loader + `error-msg`
  pattern (loading text → error text); writes are optimistic with refetch-on-
  settle, matching existing forms.
- **`place-lookup` miss:** fall back to tap-to-drop; never block the add flow.
- **Unknown region code on render:** ignore gracefully (don't crash the globe).

## Testing

- **TDD the pure modules:** `place-lookup` (name → coords, case/diacritics,
  miss → null) and the **region-code/toggle logic** (code normalization,
  visited-set membership, toggle on/off). These are pure and unit-testable.
- **Manual browser verification** for the visual/interactive layer: run a local
  preview **bound to `0.0.0.0`**, reachable at `http://pc-bp3-wsl:<port>` (per the
  remote-access setup), and confirm: region toggle persists, drill-in taps,
  destination add + pin toggle, announcement shows once for Linh, graceful globe-
  load fallback.
- Backend: smoke-test `getPlaces` / `addPlace` against the deployed Apps Script.

## Open Items / Defaults (changeable)

- Section name **"Our World"** (alternatives: Atlas / Map / Adventures).
- Shared map (not per-user). ✔ confirmed by "places *we've* been."
- No forced re-login on the announcement.
- Points-on-visit enabled.
- Geo data vendored; globe.gl via pinned CDN.
- Bundled city dataset size (~1k) — expand later if lookups miss too often.

## Rollout

1. Backend: add `Places` sheet support + `getPlaces`/`addPlace` (deploy Apps
   Script).
2. Front end: nav section + modules + styles (frontend-design).
3. Announcement modal + cookie.
4. Verify locally, then commit on a feature branch and merge.
