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

  function pinEl(d) {
    const el = document.createElement('div');
    el.className = 'globe-pin ' + (d.status === 'visited' ? 'visited' : 'wish');
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
