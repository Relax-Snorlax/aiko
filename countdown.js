(function () {
  // April 1, 2026 at 11:00 PM US Pacific (PDT = UTC-7 in April)
  const TARGET = new Date('2026-04-01T23:00:00-07:00').getTime();
  const STORAGE_KEY = 'ren-aiko-revealed';

  const $days = document.getElementById('days');
  const $hours = document.getElementById('hours');
  const $minutes = document.getElementById('minutes');
  const $seconds = document.getElementById('seconds');
  const $page = document.getElementById('page');
  const $overlay = document.getElementById('reveal-overlay');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function showReveal() {
    localStorage.setItem(STORAGE_KEY, 'true');
    $page.classList.add('page-released');
    $overlay.classList.add('active');
  }

  function tick() {
    var now = Date.now();
    var diff = TARGET - now;

    if (diff <= 0) {
      $days.textContent = '00';
      $hours.textContent = '00';
      $minutes.textContent = '00';
      $seconds.textContent = '00';
      showReveal();
      return;
    }

    var totalSeconds = Math.floor(diff / 1000);
    var d = Math.floor(totalSeconds / 86400);
    var h = Math.floor((totalSeconds % 86400) / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;

    $days.textContent = pad(d);
    $hours.textContent = pad(h);
    $minutes.textContent = pad(m);
    $seconds.textContent = pad(s);
  }

  // Check if already revealed on a previous visit
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    if (Date.now() >= TARGET) {
      showReveal();
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Start ticking
  tick();
  setInterval(tick, 1000);
})();
