(function () {
  'use strict';

  // Auth gate — redirect to the main site if the password cookie is missing
  var authed = document.cookie.split('; ').some(function (c) {
    return c.indexOf('ren-aiko-auth=true') === 0;
  });
  if (!authed) {
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
