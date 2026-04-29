(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  var CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby95uoM6nGd8lsKG-_u_aco5TJHM8iK4Sbod9yu-J4HsAjGyn6Ebpm_S-qS4oiD6jMz/exec',
    PASSWORDS: {
      'DreamGirl': 'Linh',
      'DreamBoy':  'Brian'
    },
    AUTH_COOKIE: 'ren-aiko-auth',
    AUTHOR_COOKIE: 'ren-aiko-author',
    USER_COOKIE: 'ren-aiko-user',
    FEATURE_LAUNCH: '2026-04-29T00:00:00Z',
    GLOW_DAYS: 14,
    SEEN_ANNOUNCE_COOKIE: 'ren-aiko-seen-rate-points'
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

  function markAnnouncementSeen() {
    setCookie(CONFIG.SEEN_ANNOUNCE_COOKIE, '1', 3650);
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
      var typed = input.value;
      if (CONFIG.PASSWORDS.hasOwnProperty(typed)) {
        setCookie(CONFIG.AUTH_COOKIE, 'true', 3650);
        setCookie(CONFIG.USER_COOKIE, CONFIG.PASSWORDS[typed], 3650);
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
  var lastPosts = [];

  function loadPosts() {
    apiGet('getPosts')
      .then(function (posts) {
        lastPosts = posts || [];
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
    var html = '<button class="edit-btn" data-id="' + escHtml(p.id) + '" data-type="post" title="Edit">&#9998;</button>' +
      '<div class="post-meta">' +
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

  var editingPostId = null;
  var postImageRemoved = false;

  function resetPostForm() {
    editingPostId = null;
    postImageRemoved = false;
    $('post-form').reset();
    hide($('post-current-image'));
    hide($('post-delete-btn'));
    $('post-modal').querySelector('.modal-head h3').textContent = 'New Post';
    $('post-submit').textContent = 'Post';
  }

  function openEditPost(id) {
    var p = null;
    for (var i = 0; i < lastPosts.length; i++) {
      if (String(lastPosts[i].id) === String(id)) { p = lastPosts[i]; break; }
    }
    if (!p) { alert('Post not found — please refresh.'); return; }

    resetPostForm();
    $('post-author').value = p.author || '';
    $('post-title').value = p.title || '';
    $('post-body').value = p.body || '';
    $('post-type').value = p.type || 'post';

    if (p.image_url) {
      $('post-current-image-img').src = p.image_url;
      show($('post-current-image'));
      postImageRemoved = false;
    } else {
      hide($('post-current-image'));
    }

    editingPostId = p.id;
    $('post-modal').querySelector('.modal-head h3').textContent = 'Edit Post';
    $('post-submit').textContent = 'Save Changes';
    show($('post-delete-btn'));
    openModal('post-modal');
  }

  function initPostForm() {
    $('new-post-btn').addEventListener('click', function () {
      resetPostForm();
      var saved = getCookie(CONFIG.AUTHOR_COOKIE) || getCookie(CONFIG.USER_COOKIE);
      if (saved) $('post-author').value = saved;
      openModal('post-modal');
    });

    $('post-remove-img-btn').addEventListener('click', function () {
      hide($('post-current-image'));
      postImageRemoved = true;
    });

    $('post-delete-btn').addEventListener('click', function () {
      if (!editingPostId) return;
      if (!confirm('Delete this post permanently?')) return;
      apiPost({ action: 'deleteEntry', sheet: 'Posts', id: editingPostId })
        .then(function () { closeModal('post-modal'); resetPostForm(); loadPosts(); })
        .catch(function () { alert('Failed to delete. Please try again.'); });
    });

    $('post-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('post-submit');
      btn.disabled = true;
      btn.textContent = editingPostId ? 'Saving...' : 'Posting...';

      var file = $('post-image').files[0];
      var author = $('post-author').value;
      setCookie(CONFIG.AUTHOR_COOKIE, author, 365);

      function done() {
        closeModal('post-modal');
        resetPostForm();
        btn.disabled = false;
        loadPosts();
        loadStats();
      }
      function fail() {
        btn.disabled = false;
        btn.textContent = editingPostId ? 'Save Changes' : 'Post';
        alert('Failed to save. Please try again.');
      }

      var payload;
      if (editingPostId) {
        payload = {
          action: 'editEntry',
          sheet: 'Posts',
          id: editingPostId,
          author: author,
          title: $('post-title').value,
          body: $('post-body').value,
          type: $('post-type').value
        };
        if (postImageRemoved && !file) payload.image_url = '';
        var chain = file
          ? readFileAsBase64(file).then(function (b64) {
              payload.image = b64;
              payload.image_type = file.type;
              return apiPost(payload);
            })
          : apiPost(payload);
        chain.then(done).catch(fail);
      } else {
        payload = {
          action: 'addPost',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          author: author,
          title: $('post-title').value,
          body: $('post-body').value,
          type: $('post-type').value
        };
        var chain2 = file
          ? readFileAsBase64(file).then(function (b64) {
              payload.image = b64;
              payload.image_type = file.type;
              return apiPost(payload);
            })
          : apiPost(payload);
        chain2.then(done).catch(fail);
      }
    });
  }

  // ============================================
  // Timeline
  // ============================================
  var lastTimeline = [];

  function loadTimeline() {
    apiGet('getTimeline')
      .then(function (entries) {
        lastTimeline = entries || [];
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
      var pencil = entry.id ? '<button class="edit-btn" data-id="' + escHtml(entry.id) + '" data-type="timeline" title="Edit">&#9998;</button>' : '';
      var html = pencil +
        '<div class="tl-marker"><div class="tl-dot"></div>' +
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

  var editingTimelineId = null;

  function resetTimelineForm() {
    editingTimelineId = null;
    $('timeline-form').reset();
    hide($('tl-delete-btn'));
    $('timeline-modal').querySelector('.modal-head h3').textContent = 'Add Milestone';
    $('tl-submit').textContent = 'Add Milestone';
  }

  function openEditTimeline(id) {
    var entry = null;
    for (var i = 0; i < lastTimeline.length; i++) {
      if (String(lastTimeline[i].id) === String(id)) { entry = lastTimeline[i]; break; }
    }
    if (!entry) { alert('Milestone not found — please refresh.'); return; }

    resetTimelineForm();
    var dateStr = entry.date ? String(entry.date).slice(0, 10) : '';
    $('tl-date').value = dateStr;
    $('tl-title').value = entry.title || '';
    $('tl-desc').value = entry.description || '';

    editingTimelineId = entry.id;
    $('timeline-modal').querySelector('.modal-head h3').textContent = 'Edit Milestone';
    $('tl-submit').textContent = 'Save Changes';
    show($('tl-delete-btn'));
    openModal('timeline-modal');
  }

  function initTimelineForm() {
    $('new-tl-btn').addEventListener('click', function () {
      resetTimelineForm();
      openModal('timeline-modal');
    });

    $('tl-delete-btn').addEventListener('click', function () {
      if (!editingTimelineId) return;
      if (!confirm('Delete this milestone permanently?')) return;
      apiPost({ action: 'deleteEntry', sheet: 'Timeline', id: editingTimelineId })
        .then(function () { closeModal('timeline-modal'); resetTimelineForm(); loadTimeline(); })
        .catch(function () { alert('Failed to delete. Please try again.'); });
    });

    $('timeline-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('tl-submit');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      function done() {
        closeModal('timeline-modal');
        resetTimelineForm();
        btn.disabled = false;
        loadTimeline();
        loadStats();
      }
      function fail() {
        btn.disabled = false;
        btn.textContent = editingTimelineId ? 'Save Changes' : 'Add Milestone';
        alert('Failed to save. Please try again.');
      }

      var payload;
      if (editingTimelineId) {
        payload = {
          action: 'editEntry',
          sheet: 'Timeline',
          id: editingTimelineId,
          date: $('tl-date').value,
          title: $('tl-title').value,
          description: $('tl-desc').value
        };
      } else {
        payload = {
          action: 'addTimeline',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          date: $('tl-date').value,
          title: $('tl-title').value,
          description: $('tl-desc').value
        };
      }
      apiPost(payload).then(done).catch(fail);
    });
  }

  // ============================================
  // Chats
  // ============================================
  var lastChats = [];

  function loadChats() {
    apiGet('getChats')
      .then(function (chats) {
        hide($('chats-loading'));
        hide($('chats-error'));
        if (chats && chats.error) {
          var el = $('chats-error');
          el.textContent = 'Could not load chats.';
          show(el);
          $('chats-list').innerHTML = '';
          return;
        }
        lastChats = chats || [];
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

    var html = '<button class="edit-btn" data-id="' + escHtml(c.id) + '" data-type="chat" title="Edit">&#9998;</button>' +
      '<div class="post-meta">' +
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
  var keptImageUrls = [];
  var editingChatId = null;

  function renderChatThumbs() {
    var container = $('chat-thumbs');
    container.innerHTML = '';

    keptImageUrls.forEach(function (url) {
      var wrap = document.createElement('div');
      wrap.className = 'chat-thumb';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-thumb-remove';
      btn.textContent = '\u00D7';
      btn.setAttribute('aria-label', 'Remove');
      btn.addEventListener('click', function () {
        var i = keptImageUrls.indexOf(url);
        if (i !== -1) keptImageUrls.splice(i, 1);
        renderChatThumbs();
      });
      wrap.appendChild(img);
      wrap.appendChild(btn);
      container.appendChild(wrap);
    });

    pendingImages.forEach(function (file) {
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
        var i = pendingImages.indexOf(file);
        if (i !== -1) pendingImages.splice(i, 1);
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
    keptImageUrls = [];
    editingChatId = null;
    renderChatThumbs();
    $('chat-form').reset();
    hide($('chat-form-error'));
    hide($('chat-delete-btn'));
    $('chat-modal').querySelector('.modal-head h3').textContent = 'Save Chat';
    $('chat-submit').textContent = 'Save Chat';
  }

  function openEditChat(id) {
    var c = null;
    for (var i = 0; i < lastChats.length; i++) {
      if (String(lastChats[i].id) === String(id)) { c = lastChats[i]; break; }
    }
    if (!c) { alert('Chat not found — please refresh.'); return; }

    resetChatForm();
    $('chat-author').value = c.author || '';
    $('chat-when').value = c.chat_when || '';
    $('chat-text').value = c.chat_text || '';
    $('chat-notes').value = c.notes || '';

    if (c.image_urls) {
      keptImageUrls = String(c.image_urls).split(',').map(function (u) { return u.trim(); }).filter(Boolean);
    } else {
      keptImageUrls = [];
    }
    renderChatThumbs();

    editingChatId = c.id;
    $('chat-modal').querySelector('.modal-head h3').textContent = 'Edit Chat';
    $('chat-submit').textContent = 'Save Changes';
    show($('chat-delete-btn'));
    openModal('chat-modal');
  }

  function initChatForm() {
    var dropzone = $('chat-dropzone');
    var fileInput = $('chat-images');

    $('new-chat-btn').addEventListener('click', function () {
      resetChatForm();
      var saved = getCookie(CONFIG.AUTHOR_COOKIE) || getCookie(CONFIG.USER_COOKIE);
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
      if (!text && pendingImages.length === 0 && keptImageUrls.length === 0) {
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
        loadChats();
        loadStats();
      }
      function fail() {
        btn.disabled = false;
        btn.textContent = editingChatId ? 'Save Changes' : 'Save Chat';
        alert('Failed to save chat. Please try again.');
      }

      var payload;
      if (editingChatId) {
        payload = {
          action: 'editEntry',
          sheet: 'Chats',
          id: editingChatId,
          author: author,
          chat_text: text,
          chat_when: $('chat-when').value,
          notes: $('chat-notes').value,
          image_urls: keptImageUrls.join(',')
        };
      } else {
        payload = {
          action: 'addChat',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          author: author,
          chat_text: text,
          chat_when: $('chat-when').value,
          notes: $('chat-notes').value
        };
      }

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

    $('chat-delete-btn').addEventListener('click', function () {
      if (!editingChatId) return;
      if (!confirm('Delete this chat permanently?')) return;
      apiPost({ action: 'deleteEntry', sheet: 'Chats', id: editingChatId })
        .then(function () { closeModal('chat-modal'); resetChatForm(); loadChats(); })
        .catch(function () { alert('Failed to delete. Please try again.'); });
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
  // Feedback
  // ============================================
  var lastFeedback = [];

  function loadFeedback() {
    apiGet('getFeedback')
      .then(function (rows) {
        lastFeedback = rows || [];
        hide($('feedback-loading'));
        if (!lastFeedback.length) {
          show($('feedback-empty'));
          $('feedback-feed').innerHTML = '';
          return;
        }
        hide($('feedback-empty'));
        renderFeedback(lastFeedback);
      })
      .catch(function () {
        hide($('feedback-loading'));
        var el = $('feedback-error');
        el.textContent = 'Could not load feedback.';
        show(el);
      });
  }

  function renderFeedback(rows) {
    var feed = $('feedback-feed');
    feed.innerHTML = '';
    rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    rows.forEach(function (f) { feed.appendChild(createFeedbackCard(f)); });
  }

  function createFeedbackCard(f) {
    var card = document.createElement('div');
    card.className = 'feedback-card';
    var hearts = parseInt(f.hearts, 10) || 0;
    var heartStr = '';
    for (var i = 1; i <= 5; i++) heartStr += (i <= hearts) ? '♥' : '♡';
    var html =
      '<button class="edit-btn" data-id="' + escHtml(f.id) + '" data-type="feedback" title="Edit">&#9998;</button>' +
      '<div class="fb-meta">' +
        '<span class="fb-author">' + escHtml(f.author) + ' &rarr; ' + escHtml(f.target) + '</span>' +
        '<span class="fb-date">' + formatDate(f.date) + '</span>' +
      '</div>' +
      '<div class="fb-hearts">' + heartStr + '</div>';
    if (f.comment) {
      html += '<div class="fb-comment">' + escHtml(f.comment) + '</div>';
    }
    card.innerHTML = html;
    return card;
  }

  var editingFeedbackId = null;

  function setHeartPickerValue(v) {
    var picker = $('heart-picker');
    picker.setAttribute('data-value', String(v));
    var btns = picker.querySelectorAll('.heart-btn');
    btns.forEach(function (b) {
      var idx = parseInt(b.getAttribute('data-h'), 10);
      if (idx <= v) {
        b.classList.add('filled');
        b.innerHTML = '♥';
      } else {
        b.classList.remove('filled');
        b.innerHTML = '♡';
      }
    });
  }

  function getHeartPickerValue() {
    return parseInt($('heart-picker').getAttribute('data-value'), 10) || 0;
  }

  function resetFeedbackForm() {
    editingFeedbackId = null;
    $('feedback-form').reset();
    setHeartPickerValue(0);
    hide($('feedback-delete-btn'));
    $('feedback-modal').querySelector('.modal-head h3').textContent = 'Rate Your Partner';
    $('feedback-submit').textContent = 'Send';
  }

  function openEditFeedback(id) {
    var f = null;
    for (var i = 0; i < lastFeedback.length; i++) {
      if (String(lastFeedback[i].id) === String(id)) { f = lastFeedback[i]; break; }
    }
    if (!f) { alert('Rating not found — please refresh.'); return; }
    resetFeedbackForm();
    setHeartPickerValue(parseInt(f.hearts, 10) || 0);
    $('feedback-comment').value = f.comment || '';
    editingFeedbackId = f.id;
    $('feedback-modal').querySelector('.modal-head h3').textContent = 'Edit Rating';
    $('feedback-submit').textContent = 'Save Changes';
    show($('feedback-delete-btn'));
    $('feedback-target-name').textContent = f.target || 'your partner';
    openModal('feedback-modal');
  }

  function initFeedbackForm() {
    // Heart picker click — toggle to N, or to 0 if clicking the same value
    $('heart-picker').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.heart-btn') : null;
      if (!btn) return;
      var v = parseInt(btn.getAttribute('data-h'), 10);
      var current = getHeartPickerValue();
      setHeartPickerValue(v === current ? 0 : v);
    });

    $('new-feedback-btn').addEventListener('click', function () {
      var user = getCookie(CONFIG.USER_COOKIE);
      if (!user) {
        alert('Please log out and back in to enable rating.');
        return;
      }
      resetFeedbackForm();
      var target = (user === 'Brian') ? 'Linh' : 'Brian';
      $('feedback-target-name').textContent = target;
      openModal('feedback-modal');
    });

    $('feedback-delete-btn').addEventListener('click', function () {
      if (!editingFeedbackId) return;
      if (!confirm('Delete this rating permanently?')) return;
      apiPost({ action: 'deleteEntry', sheet: 'Feedback', id: editingFeedbackId })
        .then(function () {
          closeModal('feedback-modal');
          resetFeedbackForm();
          loadFeedback();
          loadStats();
        })
        .catch(function () { alert('Failed to delete. Please try again.'); });
    });

    $('feedback-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('feedback-submit');
      btn.disabled = true;
      btn.textContent = editingFeedbackId ? 'Saving...' : 'Sending...';

      var user = getCookie(CONFIG.USER_COOKIE) || '';
      var hearts = getHeartPickerValue();
      var comment = $('feedback-comment').value;

      function done() {
        closeModal('feedback-modal');
        resetFeedbackForm();
        btn.disabled = false;
        loadFeedback();
        loadStats();
      }
      function fail() {
        btn.disabled = false;
        btn.textContent = editingFeedbackId ? 'Save Changes' : 'Send';
        alert('Failed to save. Please try again.');
      }

      var payload;
      if (editingFeedbackId) {
        payload = {
          action: 'editEntry',
          sheet: 'Feedback',
          id: editingFeedbackId,
          hearts: hearts,
          comment: comment
        };
      } else {
        payload = {
          action: 'addFeedback',
          user: user,
          hearts: hearts,
          comment: comment
        };
      }
      apiPost(payload).then(done).catch(fail);
    });
  }

  // ============================================
  // Stats footer
  // ============================================
  var TIERS = [
    { min: 0,    cls: 'tier-0' },
    { min: 5,    cls: 'tier-1' },
    { min: 20,   cls: 'tier-2' },
    { min: 50,   cls: 'tier-3' },
    { min: 100,  cls: 'tier-4' },
    { min: 150,  cls: 'tier-5' },
    { min: 250,  cls: 'tier-6' },
    { min: 500,  cls: 'tier-7' },
    { min: 1000, cls: 'tier-8' }
  ];

  function tierClassFor(points) {
    var cls = 'tier-0';
    for (var i = 0; i < TIERS.length; i++) {
      if (points >= TIERS[i].min) cls = TIERS[i].cls;
    }
    return cls;
  }

  function applyStatsForUser(name, data) {
    var key = name.toLowerCase(); // 'brian' or 'linh'
    var avatar = $('stats-avatar-' + key);
    var pts = $('stats-points-' + key);
    var rate = $('stats-rating-' + key);
    if (!avatar || !pts || !rate) return;

    var points = (data && data.points) || 0;
    var avg = (data && data.avg_hearts) || 0;
    var count = (data && data.count) || 0;

    // Reset tier classes, then add the one we want
    avatar.className = 'stats-avatar ' + tierClassFor(points);
    pts.textContent = points + ' pts';
    rate.textContent = count
      ? ('★ ' + avg.toFixed(1) + ' / 5 (' + count + ')')
      : 'no ratings yet';
  }

  function loadStats() {
    apiGet('getStats')
      .then(function (data) {
        if (!data || data.error) return;
        applyStatsForUser('Brian', data.Brian);
        applyStatsForUser('Linh',  data.Linh);
      })
      .catch(function () { /* silent — stats footer keeps placeholder values */ });
  }

  function initFeatureGlow() {
    try {
      var launch = new Date(CONFIG.FEATURE_LAUNCH).getTime();
      var elapsedDays = (Date.now() - launch) / 86400000;
      if (elapsedDays >= 0 && elapsedDays < CONFIG.GLOW_DAYS) {
        var btn = $('new-feedback-btn');
        if (btn) btn.classList.add('glow-new');
      }
    } catch (e) { /* ignore */ }
  }

  // ============================================
  // Modals
  // ============================================
  function openModal(id) { show($(id)); }
  function closeModal(id) { hide($(id)); }

  function initModals() {
    document.querySelectorAll('.modal-x').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-close');
        closeModal(id);
        resetFormForModal(id);
      });
    });
    document.querySelectorAll('.modal-bg').forEach(function (bg) {
      bg.addEventListener('click', function () {
        var modal = bg.closest('.modal');
        if (!modal) return;
        hide(modal);
        resetFormForModal(modal.id);
      });
    });
  }

  function resetFormForModal(id) {
    if (id === 'post-modal' && typeof resetPostForm === 'function') resetPostForm();
    else if (id === 'chat-modal' && typeof resetChatForm === 'function') resetChatForm();
    else if (id === 'timeline-modal' && typeof resetTimelineForm === 'function') resetTimelineForm();
    else if (id === 'feedback-modal' && typeof resetFeedbackForm === 'function') resetFeedbackForm();
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
  function logLoginEvent() {
    var user = getCookie(CONFIG.USER_COOKIE);
    if (!user) return;

    var ua = navigator.userAgent || '';
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        apiPost({
          action: 'logLogin',
          user: user,
          ip: data.ip || '',
          city: data.city || '',
          region: data.region || '',
          country: data.country_name || '',
          user_agent: ua
        }).catch(function () {});
      })
      .catch(function () {
        apiPost({
          action: 'logLogin',
          user: user,
          user_agent: ua
        }).catch(function () {});
      });
  }

  function loadDashboard() {
    logLoginEvent();
    revealUserLogout();
    loadCountdown();
    loadPosts();
    loadTimeline();
    loadChats();
    loadFeedback();
    loadStats();
    maybeShowAnnouncement();
  }

  // ============================================
  // Feature Announcement (one-time, Linh only)
  // ============================================
  function initAnnouncement() {
    var modal = $('announce-modal');
    if (!modal) return;

    var logoutBtn = $('announce-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        markAnnouncementSeen();
        forceLogout();
      });
    }

    // Mark seen on any dismissal path (× and backdrop click are auto-wired by initModals;
    // we add a sibling listener that just persists the seen state).
    var xBtn = modal.querySelector('.modal-x');
    if (xBtn) xBtn.addEventListener('click', markAnnouncementSeen);
    var bg = modal.querySelector('.modal-bg');
    if (bg) bg.addEventListener('click', markAnnouncementSeen);
  }

  function maybeShowAnnouncement() {
    if (getCookie(CONFIG.USER_COOKIE) !== 'Linh') return;
    if (getCookie(CONFIG.SEEN_ANNOUNCE_COOKIE)) return;
    var modal = $('announce-modal');
    if (!modal) return;
    show(modal);
  }

  // ============================================
  // Logout
  // ============================================
  function forceLogout() {
    setCookie(CONFIG.AUTH_COOKIE, '', -1);
    location.reload();
  }

  function logout() {
    if (!confirm('Log out?')) return;
    forceLogout();
  }

  function initLogoutButtons() {
    ['logout-header', 'logout-tagline', 'logout-stats-brian', 'logout-stats-linh']
      .forEach(function (id) {
        var btn = $(id);
        if (btn) btn.addEventListener('click', logout);
      });
  }

  function revealUserLogout() {
    var user = getCookie(CONFIG.USER_COOKIE);
    if (user === 'Brian') show($('logout-stats-brian'));
    else if (user === 'Linh') show($('logout-stats-linh'));
  }

  function initEditDelegate() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.edit-btn') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var type = btn.getAttribute('data-type');
      if (type === 'post') openEditPost(id);
      else if (type === 'chat') openEditChat(id);
      else if (type === 'timeline') openEditTimeline(id);
      else if (type === 'feedback') openEditFeedback(id);
    });
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
    initFeedbackForm();
    initLightbox();
    initEditDelegate();
    initFeatureGlow();
    initLogoutButtons();
    initAnnouncement();

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
