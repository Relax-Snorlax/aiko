// Flat SVG US map drill-in. Loads data/us-states.svg, wires state clicks,
// and reflects visited state via CSS classes. Browser-only.
import { spawnFx } from './globe-view.js';

export async function createUsInset(container, opts) {
  const { getVisited, onStateClick } = opts;
  const res = await fetch('data/us-states.svg');
  container.innerHTML = await res.text();
  const svg = container.querySelector('svg');
  if (!svg) return { refresh() {} };

  svg.addEventListener('click', e => {
    const path = e.target.closest('path[data-code]');
    if (!path) return;
    const code = path.getAttribute('data-code');
    const adding = !getVisited().has(code); // claiming vs releasing — before toggle
    // Same dopamine as the globe: ripple + spark at the tap + a flash on the state.
    const rect = container.getBoundingClientRect();
    spawnFx(container, e.clientX - rect.left, e.clientY - rect.top, adding);
    path.classList.remove('just-claimed', 'just-released');
    void path.getBoundingClientRect(); // restart the CSS animation
    path.classList.add(adding ? 'just-claimed' : 'just-released');
    // Drop the flash class once it finishes so the visited/unvisited glow resumes.
    path.addEventListener('animationend', () => path.classList.remove('just-claimed', 'just-released'), { once: true });
    onStateClick(code);
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
