// Themed globe.gl globe: clickable country polygons (glow when unvisited),
// destination pins, gentle auto-rotate. Browser-only (imports globe.gl).
// API verified against globe.gl@2.46.1 type defs: Globe is a constructor
// (`new Globe(el)`), polygon/html/atmosphere accessors come from three-globe.
import Globe from 'https://esm.sh/globe.gl@2.46.1';

const THEME = {
  bg: '#0a0a0f',
  visited: 'rgba(199,130,175,0.85)', // solid mauve
  stroke: 'rgba(245,230,211,0.35)',  // cream outline
  atmosphere: '#c782af'
};

// 1x1 dark PNG -> uniform dark sphere (polygons + atmosphere carry the color).
const DARK_TEX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export function createGlobeView(container, opts) {
  const { countries, getVisited, getDestinations, onRegionClick, onPinClick } = opts;
  const codeOf = f => (f.properties && f.properties.code) || '';

  // Zoom-in label anchors (lat/lng). Countries + US states are precomputed in
  // data/map-labels.json; POIs are major cities. Shown by zoom tier, filtered
  // to the visible hemisphere — see chooseLabels().
  const COUNTRIES = (opts.labels && opts.labels.countries) || [];
  const STATES = (opts.labels && opts.labels.states) || [];
  const POIS = opts.pois || [];

  // pulse drives the unvisited glow; throttled re-eval keeps mobile smooth.
  let pulse = 0;
  function capColor(f) {
    if (getVisited().has(codeOf(f))) return THEME.visited;
    const a = (0.10 + pulse * 0.30).toFixed(3); // 0.10..0.40 cream glow
    return `rgba(245,230,211,${a})`;
  }

  // Pin = a dot on the coordinate + an always-on name label beneath it, so the
  // place is readable without hovering (hover tooltips are dead on touch).
  function pinEl(d) {
    const el = document.createElement('div');
    el.className = 'globe-pin ' + (d.status === 'visited' ? 'visited' : 'wish');
    const dot = document.createElement('span');
    dot.className = 'globe-pin-dot';
    const label = document.createElement('span');
    label.className = 'globe-pin-label';
    label.textContent = d.name; // textContent: name is user-supplied — no HTML injection
    el.append(dot, label);
    el.title = d.name + (d.status === 'visited' ? ' (visited)' : ' (wishlist)');
    el.addEventListener('click', e => { e.stopPropagation(); onPinClick(d); });
    return el;
  }

  // Zoom-in place label — crisp upright HTML, haloed for contrast against the
  // globe, pointer-transparent. (Replaced the old 3D text sprites, which had no
  // occlusion and bled through from the back, and were low-contrast.)
  function labelEl(d) {
    const el = document.createElement('div');
    el.className = 'globe-label ' + d.cls; // country | state | poi
    el.textContent = d.text; // textContent: place names — no HTML injection
    return el;
  }

  // globe.gl@2.46.1: instantiate with `new` (the old Globe()(el) factory was
  // removed in the 2.4x line).
  const world = new Globe(container)
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
    .polygonsTransitionDuration(0) // 0: glow re-applies cap colors ~12fps; a tween here would never finish and look laggy/flat
    .polygonLabel(f => (f.properties && f.properties.name) || '') // hover/tap a country to read its name
    .onPolygonClick((f, event, coords) => {
      const code = codeOf(f);
      const adding = !getVisited().has(code); // claiming vs releasing — before the toggle
      const ll = (coords && Number.isFinite(coords.lat)) ? [coords.lng, coords.lat] : centroidOf(f);
      celebrate(ll[1], ll[0], adding); // dopamine: ripple + spark right where you tapped
      onRegionClick(code);
    })
    // Pins AND zoom-labels share the single html layer — globe.gl auto-occludes
    // far-side html elements, so back labels cleanly vanish (no show-through) and
    // front ones stay crisp. The element type is chosen per datum.
    .htmlElementsData(getDestinations())
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(d => d.__t === 'label' ? 0.008 : 0.02)
    .htmlElement(d => d.__t === 'label' ? labelEl(d) : pinEl(d));

  world.width(container.clientWidth).height(container.clientHeight || 420);

  // Rings layer = the "claim" ripple that pulses out from a clicked region.
  let rings = [];
  world
    .ringColor(d => d.colorFn)
    .ringMaxRadius(d => d.maxR)
    .ringPropagationSpeed(d => d.speed)
    .ringRepeatPeriod(() => 1e6) // one-shot: emit once, we drop the datum before it repeats
    .ringAltitude(0.011)
    .ringsData(rings);

  // Dopamine on (un)claim: a ripple pulses out from the tapped point on the
  // globe + a little spark pops in screen space. Tasteful, ~1s, self-cleaning.
  function celebrate(lat, lng, adding) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const rgb = adding ? '199,130,175' : '245,230,211'; // mauve claim / cream release
    const a0 = adding ? 0.6 : 0.45;
    const ring = {
      lat, lng,
      maxR: adding ? 4.2 : 3.4,
      speed: adding ? 4 : 5,
      colorFn: t => `rgba(${rgb},${(a0 * (1 - t)).toFixed(3)})`
    };
    rings = rings.concat(ring);
    world.ringsData(rings);
    setTimeout(() => { rings = rings.filter(r => r !== ring); world.ringsData(rings); }, 1200);
    spawnSpark(lat, lng, adding);
  }

  function spawnSpark(lat, lng, adding) {
    let sc;
    try { sc = world.getScreenCoords(lat, lng, 0.02); } catch (e) { return; }
    if (!sc) return;
    const el = document.createElement('div');
    el.className = 'globe-spark ' + (adding ? 'add' : 'remove');
    el.textContent = adding ? '♥' : '✦'; // ♥ claim / ✦ release
    el.style.left = sc.x + 'px';
    el.style.top = sc.y + 'px';
    container.appendChild(el);
    const done = () => el.remove();
    el.addEventListener('animationend', done);
    setTimeout(done, 1300); // safety net if animationend doesn't fire
  }

  // Rough centroid (outer-ring average) — fallback when click coords are absent.
  function centroidOf(f) {
    const g = f && f.geometry;
    if (!g) return [0, 0];
    const ring = g.type === 'Polygon' ? g.coordinates[0] : (g.coordinates[0] && g.coordinates[0][0]);
    if (!ring || !ring.length) return [0, 0];
    let x = 0, y = 0;
    for (const c of ring) { x += c[0]; y += c[1]; }
    return [x / ring.length, y / ring.length];
  }

  const ctrls = world.controls();
  // Auto-rotate OFF: globe.gl hides html pins on the far hemisphere, so a
  // spinning globe makes destination pins (and their names) blink in and out —
  // and a just-added pin can land on the back, invisible. A calm, draggable
  // globe keeps pins readable. (Was the core of "can't see places" / "add
  // isn't working".) stopSpin stays wired in case rotate is re-enabled.
  ctrls.autoRotate = false;
  ctrls.autoRotateSpeed = 0.6;
  const stopSpin = () => { ctrls.autoRotate = false; };

  // While the user is dragging/zooming/clicking, pause the glow re-color: the
  // full-polygon recolor competes with hit-testing + the camera, making
  // interaction feel laggy. Resume the glow shortly after they stop. This is
  // the "snappier clicking" lever — keep the main thread free during input.
  let interacting = false, interactTimer = null;
  const endInteract = () => {
    clearTimeout(interactTimer);
    interactTimer = setTimeout(() => { interacting = false; }, 300);
  };
  const beginInteract = () => { interacting = true; clearTimeout(interactTimer); };
  container.addEventListener('pointerdown', () => { stopSpin(); beginInteract(); });
  window.addEventListener('pointerup', endInteract);
  container.addEventListener('wheel', () => { stopSpin(); beginInteract(); endInteract(); }, { passive: true });

  // Step zoom for the +/- buttons — globe.gl wheel/pinch zoom works, but the
  // buttons make it discoverable (the core of "can't zoom"). Clamped so you
  // can't fly through or lose the globe. Reuses the focusUS pointOfView pattern.
  function zoomBy(factor) {
    stopSpin();
    beginInteract(); endInteract();
    const pov = world.pointOfView();
    const altitude = Math.min(4, Math.max(0.35, pov.altitude * factor));
    world.pointOfView({ altitude }, 350);
  }

  // Angular distance (degrees) between two lat/lng points — for "is this label
  // on the visible side of the globe near where I'm looking?".
  function angDist(la1, lo1, la2, lo2) {
    const r = Math.PI / 180;
    const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / r;
  }

  // The html layer holds pins + the current label set. syncHtml rebuilds it;
  // pin objects keep stable identity so globe.gl doesn't recreate their elements.
  let currentLabels = [];
  function syncHtml() {
    world.htmlElementsData(getDestinations().concat(currentLabels));
  }

  // Zoom-tiered, DE-CLUTTERED labels — clarity is the goal. Tier by altitude
  // (out→none, mid→countries, close→ +states +POIs). Candidates near the view
  // center are sorted by priority (countries/states beat POIs; nearer first),
  // then greedily placed while skipping any that would sit within minSep° of one
  // already placed — so labels never pile on top of each other. Hard total cap.
  let labelSig = '';
  function chooseLabels() {
    const pov = world.pointOfView();
    const cand = [];
    if (pov.altitude <= 1.55) {
      const radius = Math.min(85, Math.max(18, pov.altitude * 60));
      const add = (arr, cls, penalty) => {
        for (const d of arr) {
          const nd = angDist(pov.lat, pov.lng, d.lat, d.lng);
          if (nd <= radius) cand.push({ lat: d.lat, lng: d.lng, text: d.name, cls, pri: nd + penalty });
        }
      };
      add(COUNTRIES, 'country', 0);
      if (pov.altitude <= 0.85) { add(STATES, 'state', 0); add(POIS, 'poi', 120); }
    }
    cand.sort((a, b) => a.pri - b.pri);
    const minSep = Math.min(13, Math.max(3.5, pov.altitude * 15)); // ° between labels; denser when closer
    const placed = [];
    for (const c of cand) {
      if (placed.length >= 22) break; // hard total cap — readability over completeness
      if (placed.some(p => angDist(p.lat, p.lng, c.lat, c.lng) < minSep)) continue;
      placed.push(c);
    }
    const sig = placed.map(p => p.cls + p.text).join('|');
    if (sig === labelSig) return;
    labelSig = sig;
    currentLabels = placed.map(p => ({ __t: 'label', lat: p.lat, lng: p.lng, text: p.text, cls: p.cls }));
    syncHtml();
    container.setAttribute('data-label-count', String(currentLabels.length));
  }

  // lean: re-eval cap colors ~12fps for the glow pulse — cheap enough for ~177
  // polygons; drop to a setInterval at lower rate if a weak device struggles.
  let last = 0, raf, settlePov = { a: 1e3, lat: 1e3, lng: 1e3 }, moveT = -1;
  function animate(t) {
    if (!interacting && t - last > 80) {
      pulse = (Math.sin(t / 700) + 1) / 2;
      world.polygonCapColor(capColor);
      last = t;
    }
    // Recompute labels only AFTER the view settles (~140ms still) — not every
    // frame. During motion, existing labels ride the globe via globe.gl's own
    // positioning, so they track correctly and don't churn/flicker.
    const pov = world.pointOfView();
    if (pov.altitude !== settlePov.a || pov.lat !== settlePov.lat || pov.lng !== settlePov.lng) {
      settlePov = { a: pov.altitude, lat: pov.lat, lng: pov.lng };
      moveT = t;
    } else if (moveT >= 0 && t - moveT > 140) {
      chooseLabels();
      moveT = -1;
    }
    raf = requestAnimationFrame(animate);
  }
  raf = requestAnimationFrame(animate);

  return {
    refresh() {
      world.polygonCapColor(capColor);
      syncHtml(); // pins + current labels
    },
    // Region click only changes polygon colors — skip the pin (htmlElements)
    // rebuild to keep the click path light.
    recolor() {
      world.polygonCapColor(capColor);
    },
    focusUS() {
      world.pointOfView({ lat: 39.8, lng: -98.6, altitude: 1.6 }, 900);
    },
    // Rotate the globe to face a coordinate — globe.gl occludes back-facing
    // pins, so we turn newly-added/selected places to the front to be seen.
    focusOn(lat, lng) {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        stopSpin();
        beginInteract(); endInteract();
        world.pointOfView({ lat, lng, altitude: 1.7 }, 800);
      }
    },
    zoomIn() { zoomBy(0.65); },
    zoomOut() { zoomBy(1.5); },
    resize() {
      world.width(container.clientWidth).height(container.clientHeight || 420);
    },
    destroy() { cancelAnimationFrame(raf); }
  };
}
