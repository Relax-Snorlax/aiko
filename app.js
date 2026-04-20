(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  var CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby95uoM6nGd8lsKG-_u_aco5TJHM8iK4Sbod9yu-J4HsAjGyn6Ebpm_S-qS4oiD6jMz/exec',
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
      var hasImage = (payload.image && payload.image.length > 0) ||
               (payload.images && payload.images.length > 0);
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
  // Chats
  // ============================================
  function loadChats() {
    apiGet('getChats')
      .then(function (chats) {
        hide($('chats-loading'));
        if (!chats || !chats.length) {
          show($('chats-empty'));
          $('chats-list').innerHTML = '';
          return;
        }
        hide($('chats-empty'));
        renderChats(chats);
      })
      .catch(function () {
        hide($('chats-loading'));
        var el = $('chats-error');
        el.textContent = 'Could not load chats.';
        show(el);
      });
  }

  function renderChats(chats) {
    var list = $('chats-list');
    list.innerHTML = '';
    chats.sort(function (a, b) { return new Date(b.saved_date) - new Date(a.saved_date); });
    chats.forEach(function (c) { list.appendChild(createChatCard(c)); });
  }

  function createChatCard(c) {
    var card = document.createElement('div');
    card.className = 'chat-card';

    var html = '<div class="post-meta">' +
      '<span class="post-author">' + escHtml(c.author) + '</span>' +
      '<span class="post-date">saved ' + formatDate(c.saved_date) + '</span>' +
      '</div>';

    if (c.chat_when) {
      html += '<div class="chat-when">Chat from: ' + escHtml(c.chat_when) + '</div>';
    }

    if (c.image_urls) {
      var urls = String(c.image_urls).split(',').map(function (u) { return u.trim(); }).filter(Boolean);
      var safeUrls = urls.filter(function (u) { return u.indexOf('https://') === 0; });
      if (safeUrls.length) {
        html += '<div class="chat-images">';
        safeUrls.forEach(function (u) {
          html += '<img class="chat-img" src="' + escHtml(u) + '" alt="Chat screenshot" loading="lazy">';
        });
        html += '</div>';
      }
    }

    if (c.chat_text) {
      html += '<pre class="chat-text">' + escHtml(c.chat_text) + '</pre>';
    }

    if (c.notes) {
      html += '<div class="chat-notes">' + escHtml(c.notes) + '</div>';
    }

    card.innerHTML = html;
    return card;
  }

  var pendingImages = [];

  function renderChatThumbs() {
    var container = $('chat-thumbs');
    container.innerHTML = '';
    pendingImages.forEach(function (file, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'chat-thumb';
      var img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-thumb-remove';
      btn.textContent = '\u00D7';
      btn.setAttribute('aria-label', 'Remove');
      btn.addEventListener('click', function () {
        pendingImages.splice(idx, 1);
        renderChatThumbs();
      });
      wrap.appendChild(img);
      wrap.appendChild(btn);
      container.appendChild(wrap);
    });
  }

  function addPendingImageFiles(files) {
    if (!files) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f && f.type && f.type.indexOf('image/') === 0) {
        pendingImages.push(f);
      }
    }
    renderChatThumbs();
  }

  function resetChatForm() {
    pendingImages = [];
    renderChatThumbs();
    $('chat-form').reset();
    hide($('chat-form-error'));
  }

  function initChatForm() {
    var dropzone = $('chat-dropzone');
    var fileInput = $('chat-images');

    $('new-chat-btn').addEventListener('click', function () {
      var saved = getCookie(CONFIG.AUTHOR_COOKIE);
      if (saved) $('chat-author').value = saved;
      openModal('chat-modal');
    });

    // File picker — clicking the dropzone opens the native file dialog
    dropzone.addEventListener('click', function (e) {
      // Don't trigger when clicking the remove button on a thumb
      if (e.target.closest('.chat-thumb-remove')) return;
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      addPendingImageFiles(fileInput.files);
      fileInput.value = '';
    });

    // Drag & drop
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files) {
        addPendingImageFiles(e.dataTransfer.files);
      }
    });

    // Clipboard paste — listens on document while the modal is open
    document.addEventListener('paste', function (e) {
      if ($('chat-modal').classList.contains('hidden')) return;
      if (!e.clipboardData) return;
      var items = e.clipboardData.items;
      if (!items) return;
      var files = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.kind === 'file' && it.type.indexOf('image/') === 0) {
          var f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        addPendingImageFiles(files);
      }
    });

    $('chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = $('chat-form-error');
      var text = $('chat-text').value.trim();
      if (!text && pendingImages.length === 0) {
        errEl.textContent = 'Add chat text or at least one screenshot.';
        show(errEl);
        return;
      }
      hide(errEl);

      var btn = $('chat-submit');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      var author = $('chat-author').value;
      setCookie(CONFIG.AUTHOR_COOKIE, author, 365);

      function done() {
        closeModal('chat-modal');
        resetChatForm();
        btn.disabled = false;
        btn.textContent = 'Save Chat';
        loadChats();
      }

      function fail() {
        btn.disabled = false;
        btn.textContent = 'Save Chat';
        alert('Failed to save chat. Please try again.');
      }

      var payload = {
        action: 'addChat',
        author: author,
        chat_text: text,
        chat_when: $('chat-when').value,
        notes: $('chat-notes').value
      };

      if (pendingImages.length === 0) {
        apiPost(payload).then(done).catch(fail);
        return;
      }

      var readers = pendingImages.map(function (file) {
        return readFileAsBase64(file).then(function (b64) {
          return { data: b64, type: file.type };
        });
      });

      Promise.all(readers).then(function (images) {
        payload.images = JSON.stringify(images);
        return apiPost(payload);
      }).then(done).catch(fail);
    });
  }

  function initLightbox() {
    var box = $('lightbox');
    var img = $('lightbox-img');

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('chat-img')) {
        img.src = t.getAttribute('src');
        show(box);
      }
    });

    box.addEventListener('click', function () {
      hide(box);
      img.src = '';
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
    $('nav-toggle').addEventListener('click', function () {
      document.querySelector('.header-nav').classList.toggle('open');
    });

    document.querySelectorAll('.header-nav .nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector('.header-nav').classList.remove('open');

        var sectionId = a.getAttribute('data-section');
        var section = $(sectionId);

        // Toggle: if visible, hide it; if hidden, show it
        if (section.classList.contains('hidden')) {
          show(section);
          a.classList.add('active');
          section.scrollIntoView({ behavior: 'smooth' });
        } else {
          hide(section);
          a.classList.remove('active');
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
    loadChats();
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
    initChatForm();
    initLightbox();
    initArchiveToggle();

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
