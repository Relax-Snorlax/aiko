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
    .onPolygonClick(f => onRegionClick(codeOf(f)))
    .htmlElementsData(getDestinations())
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlAltitude(0.02)
    .htmlElement(pinEl);

  world.width(container.clientWidth).height(container.clientHeight || 420);

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

  // lean: re-eval cap colors ~12fps for the glow pulse — cheap enough for ~177
  // polygons; drop to a setInterval at lower rate if a weak device struggles.
  let last = 0, raf;
  function animate(t) {
    if (!interacting && t - last > 80) {
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
