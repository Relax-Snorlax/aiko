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
    const code = path.getAttribute('data-code');
    const adding = !getVisited().has(code); // claiming vs releasing — before toggle
    // Same dopamine as the globe: a spark at the tap + a quick flash on the state.
    spawnSpark(e.clientX, e.clientY, adding);
    path.classList.remove('just-claimed', 'just-released');
    void path.getBoundingClientRect(); // restart the CSS animation
    path.classList.add(adding ? 'just-claimed' : 'just-released');
    // Drop the flash class once it finishes so the visited/unvisited glow resumes.
    path.addEventListener('animationend', () => path.classList.remove('just-claimed', 'just-released'), { once: true });
    onStateClick(code);
  });

  // Screen-space spark, mirrors globe-view's. Positioned within the inset.
  function spawnSpark(clientX, clientY, adding) {
    const rect = container.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'globe-spark ' + (adding ? 'add' : 'remove');
    el.textContent = adding ? '♥' : '✦';
    el.style.left = (clientX - rect.left) + 'px';
    el.style.top = (clientY - rect.top) + 'px';
    container.appendChild(el);
    const done = () => el.remove();
    el.addEventListener('animationend', done);
    setTimeout(done, 1300);
  }

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
