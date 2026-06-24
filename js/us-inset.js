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
