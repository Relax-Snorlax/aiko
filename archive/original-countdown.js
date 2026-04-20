(function () {
  'use strict';

  // Auth gate (defense in depth — head inline script handles the primary redirect).
  // Matches the getCookie pattern used in app.js.
  var match = document.cookie.match(/(^| )ren-aiko-auth=([^;]+)/);
  if (!match || match[2] !== 'true') {
    window.location.replace('/');
    return;
  }

  // Before/After toggle
  var btns = document.querySelectorAll('.archive-toggle .toggle-btn');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.archive-view').forEach(function (v) {
        v.classList.remove('active');
      });
      var target = document.getElementById(btn.getAttribute('data-show'));
      if (target) target.classList.add('active');
    });
  });
})();
