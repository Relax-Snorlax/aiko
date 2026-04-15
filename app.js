(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  var CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyh8oqcQvlror3-UMYX4Pu9aM3b6Itsj27T7xoRVduTjOG7fNUxfSh-KKilnM1wGLPO/exec',
    PASSWORD: 'DreamGirl',
    AUTH_COOKIE: 'ren-aiko-auth',
    AUTHOR_COOKIE: 'ren-aiko-author'
  };

  // ============================================
  // Utilities
  // ============================================
  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function $(id) { return document.getElementById(id); }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDate(str) {
    if (!str) return '';
    var d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ============================================
  // Auth / Password Gate
  // ============================================
  function isAuthed() {
    return getCookie(CONFIG.AUTH_COOKIE) === 'true';
  }

  function initGate() {
    var gate = $('gate');
    var input = $('gate-input');
    var btn = $('gate-btn');
    var error = $('gate-error');

    function attempt() {
      if (input.value === CONFIG.PASSWORD) {
        setCookie(CONFIG.AUTH_COOKIE, 'true', 3650);
        gate.style.transition = 'opacity 0.5s';
        gate.style.opacity = '0';
        setTimeout(function () {
          hide(gate);
          show($('dashboard'));
          loadDashboard();
        }, 500);
      } else {
        error.textContent = 'Incorrect password';
        gate.classList.add('shake');
        setTimeout(function () { gate.classList.remove('shake'); }, 400);
      }
    }

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attempt();
    });
  }

  // ============================================
  // API Layer
  // ============================================

  // GET requests — used for reads. Fetch follows the Apps Script 302 redirect.
  function apiGet(action) {
    return fetch(CONFIG.SCRIPT_URL + '?action=' + action)
      .then(function (r) { return r.text(); })
      .then(function (t) { return JSON.parse(t); });
  }

  // POST requests — uses hidden iframe + form to bypass CORS/redirect issues.
  // Apps Script returns an HTML page with postMessage to send the result back.
  // Falls back to a timeout if postMessage doesn't fire.
  function apiPost(payload) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement('iframe');
      iframe.name = 'f' + Date.now();
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      var form = document.createElement('form');
      form.method = 'POST';
      form.action = CONFIG.SCRIPT_URL;
      form.target = iframe.name;
      form.style.display = 'none';

      Object.keys(payload).forEach(function (key) {
        if (payload[key] == null) return;
        var inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = key;
        inp.value = payload[key];
        form.appendChild(inp);
      });

      document.body.appendChild(form);

      var resolved = false;
      var hasImage = payload.image && payload.image.length > 0;
      var timeoutMs = hasImage ? 30000 : 10000;

      function cleanup() {
        resolved = true;
        window.removeEventListener('message', onMsg);
        clearTimeout(fallback);
        setTimeout(function () { iframe.remove(); form.remove(); }, 100);
      }

      function onMsg(event) {
        if (resolved) return;
        if (typeof event.data === 'string') {
          try {
            var result = JSON.parse(event.data);
            if (result.success !== undefined || result.error !== undefined) {
              cleanup();
              if (result.error) { reject(new Error(result.error)); }
              else { resolve(result); }
            }
          } catch (e) { /* not our message, ignore */ }
        }
      }

      window.addEventListener('message', onMsg);

      // Fallback: if no postMessage received, assume success and let the
      // caller refetch data to confirm.
      var fallback = setTimeout(function () {
        if (!resolved) {
          cleanup();
          resolve({ success: true });
        }
      }, timeoutMs);

      form.submit();
    });
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    });
  }

  // ============================================
  // Countdown
  // ============================================
  var countdownInterval = null;
  var countdownTarget = null;

  function loadCountdown() {
    apiGet('getCountdown')
      .then(function (data) {
        hide($('countdown-loading'));
        show($('countdown-content'));
        applyCountdown(data);
      })
      .catch(function () {
        $('countdown-loading').textContent = 'Could not load countdown.';
      });
  }

  function applyCountdown(data) {
    $('cd-label').textContent = data.label || '';

    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

    if (!data.target_date) {
      hide($('cd-timer'));
      hide($('cd-reached'));
      show($('cd-tbd'));
      $('cd-tbd').textContent = data.tbd_message || 'Date coming soon...';
      return;
    }

    countdownTarget = new Date(data.target_date).getTime();
    if (isNaN(countdownTarget)) {
      hide($('cd-timer'));
      hide($('cd-reached'));
      show($('cd-tbd'));
      $('cd-tbd').textContent = data.tbd_message || 'Date coming soon...';
      return;
    }

    show($('cd-timer'));
    hide($('cd-tbd'));
    hide($('cd-reached'));
    tickCountdown();
    countdownInterval = setInterval(tickCountdown, 1000);
  }

  function tickCountdown() {
    var diff = countdownTarget - Date.now();
    if (diff <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      hide($('cd-timer'));
      show($('cd-reached'));
      $('cd-reached').textContent = 'The moment is here!';
      return;
    }
    var s = Math.floor(diff / 1000);
    $('cd-days').textContent = pad(Math.floor(s / 86400));
    $('cd-hours').textContent = pad(Math.floor((s % 86400) / 3600));
    $('cd-mins').textContent = pad(Math.floor((s % 3600) / 60));
    $('cd-secs').textContent = pad(s % 60);
  }

  function initCountdownForm() {
    $('countdown-edit').addEventListener('click', function () {
      openModal('countdown-modal');
    });

    $('countdown-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('cd-submit');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      apiPost({
        action: 'updateCountdown',
        label: $('cd-form-label').value,
        target_date: $('cd-form-date').value,
        tbd_message: $('cd-form-tbd').value
      }).then(function () {
        closeModal('countdown-modal');
        $('countdown-form').reset();
        btn.disabled = false;
        btn.textContent = 'Update Countdown';
        loadCountdown();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Update Countdown';
        alert('Failed to update countdown. Please try again.');
      });
    });
  }

  // ============================================
  // Posts
  // ============================================
  function loadPosts() {
    apiGet('getPosts')
      .then(function (posts) {
        hide($('posts-loading'));
        var regular = [];
        var archived = [];
        posts.forEach(function (p) {
          if (p.type === 'archive') { archived.push(p); }
          else { regular.push(p); }
        });

        if (regular.length) {
          hide($('posts-empty'));
          renderPosts(regular);
        } else {
          show($('posts-empty'));
        }

        renderArchivePosts(archived);
      })
      .catch(function () {
        hide($('posts-loading'));
        var el = $('posts-error');
        el.textContent = 'Could not load posts.';
        show(el);
      });
  }

  function renderPosts(posts) {
    var feed = $('posts-feed');
    feed.innerHTML = '';
    posts.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    posts.forEach(function (p) { feed.appendChild(createPostCard(p)); });
  }

  function renderArchivePosts(posts) {
    var container = $('archive-posts');
    container.innerHTML = '';
    if (!posts.length) return;
    posts.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    posts.forEach(function (p) {
      var card = createPostCard(p);
      card.classList.add('archive-post');
      container.appendChild(card);
    });
  }

  function createPostCard(p) {
    var card = document.createElement('div');
    card.className = 'post-card';
    var html = '<div class="post-meta">' +
      '<span class="post-author">' + escHtml(p.author) + '</span>' +
      '<span class="post-date">' + formatDate(p.date) + '</span>' +
      '</div>';
    if (p.title) {
      html += '<h3 class="post-title">' + escHtml(p.title) + '</h3>';
    }
    html += '<div class="post-body">' + escHtml(p.body) + '</div>';
    if (p.image_url) {
      html += '<div class="post-image"><img src="' + escHtml(p.image_url) + '" alt="Post image" loading="lazy"></div>';
    }
    card.innerHTML = html;
    return card;
  }

  function initPostForm() {
    $('new-post-btn').addEventListener('click', function () {
      var saved = getCookie(CONFIG.AUTHOR_COOKIE);
      if (saved) $('post-author').value = saved;
      openModal('post-modal');
    });

    $('post-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('post-submit');
      btn.disabled = true;
      btn.textContent = 'Posting...';

      var file = $('post-image').files[0];
      var payload = {
        action: 'addPost',
        author: $('post-author').value,
        title: $('post-title').value,
        body: $('post-body').value,
        type: $('post-type').value
      };

      setCookie(CONFIG.AUTHOR_COOKIE, payload.author, 365);

      var chain = file
        ? readFileAsBase64(file).then(function (b64) {
            payload.image = b64;
            payload.image_type = file.type;
            return apiPost(payload);
          })
        : apiPost(payload);

      chain.then(function () {
        closeModal('post-modal');
        $('post-form').reset();
        btn.disabled = false;
        btn.textContent = 'Post';
        loadPosts();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Post';
        alert('Failed to create post. Please try again.');
      });
    });
  }

  // ============================================
  // Timeline
  // ============================================
  function loadTimeline() {
    apiGet('getTimeline')
      .then(function (entries) {
        hide($('timeline-loading'));
        if (!entries.length) {
          show($('timeline-empty'));
          return;
        }
        hide($('timeline-empty'));
        renderTimeline(entries);
      })
      .catch(function () {
        hide($('timeline-loading'));
        var el = $('timeline-error');
        el.textContent = 'Could not load timeline.';
        show(el);
      });
  }

  function renderTimeline(entries) {
    var container = $('timeline-list');
    container.innerHTML = '';
    entries.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    entries.forEach(function (entry, i) {
      var item = document.createElement('div');
      item.className = 'tl-item';
      var html = '<div class="tl-marker"><div class="tl-dot"></div>' +
        (i < entries.length - 1 ? '<div class="tl-line"></div>' : '') +
        '</div><div class="tl-content">' +
        '<div class="tl-date">' + formatDate(entry.date) + '</div>' +
        '<div class="tl-title">' + escHtml(entry.title) + '</div>';
      if (entry.description) {
        html += '<div class="tl-desc">' + escHtml(entry.description) + '</div>';
      }
      html += '</div>';
      item.innerHTML = html;
      container.appendChild(item);
    });
  }

  function initTimelineForm() {
    $('new-tl-btn').addEventListener('click', function () {
      openModal('timeline-modal');
    });

    $('timeline-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('tl-submit');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      apiPost({
        action: 'addTimeline',
        date: $('tl-date').value,
        title: $('tl-title').value,
        description: $('tl-desc').value
      }).then(function () {
        closeModal('timeline-modal');
        $('timeline-form').reset();
        btn.disabled = false;
        btn.textContent = 'Add Milestone';
        loadTimeline();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Add Milestone';
        alert('Failed to add milestone. Please try again.');
      });
    });
  }

  // ============================================
  // Archive Toggle
  // ============================================
  function initArchiveToggle() {
    var btns = document.querySelectorAll('.archive-toggle .toggle-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.archive-view').forEach(function (v) {
          v.classList.remove('active');
        });
        var target = $(btn.getAttribute('data-show'));
        if (target) target.classList.add('active');
      });
    });
  }

  // ============================================
  // Modals
  // ============================================
  function openModal(id) { show($(id)); }
  function closeModal(id) { hide($(id)); }

  function initModals() {
    document.querySelectorAll('.modal-x').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal(btn.getAttribute('data-close'));
      });
    });
    document.querySelectorAll('.modal-bg').forEach(function (bg) {
      bg.addEventListener('click', function () {
        var modal = bg.closest('.modal');
        if (modal) hide(modal);
      });
    });
  }

  // ============================================
  // Mobile Nav
  // ============================================
  function initNav() {
    var archiveSection = $('archive-section');

    $('nav-toggle').addEventListener('click', function () {
      document.querySelector('.header-nav').classList.toggle('open');
    });

    document.querySelectorAll('.header-nav a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        document.querySelector('.header-nav').classList.remove('open');

        // Toggle archive section visibility
        if (a.getAttribute('href') === '#archive-section') {
          e.preventDefault();
          if (archiveSection.classList.contains('hidden')) {
            show(archiveSection);
            archiveSection.scrollIntoView({ behavior: 'smooth' });
          } else {
            hide(archiveSection);
          }
        } else {
          // Hide archive when navigating to other sections
          hide(archiveSection);
        }
      });
    });
  }

  // ============================================
  // Dashboard Init
  // ============================================
  function loadDashboard() {
    loadCountdown();
    loadPosts();
    loadTimeline();
  }

  // ============================================
  // Main Init
  // ============================================
  function init() {
    initGate();
    initModals();
    initNav();
    initCountdownForm();
    initPostForm();
    initTimelineForm();
    initArchiveToggle();

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
