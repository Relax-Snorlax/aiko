# Saved Chats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Saved Chats" sub-section nested inside Archive on `linhyeh.brianpham.us` that lets users save conversations via uploaded/pasted/dragged screenshots and/or pasted chat text, with author, when-the-chat-happened (free text), and notes.

**Architecture:** Follow the established pattern — static HTML/CSS/JS frontend calls Google Apps Script (GET for reads, hidden-iframe POST for writes). New `Chats` sheet tab stores entries; multi-image screenshots upload to the same Drive folder and store as a comma-separated URL list. UI nested inside `#archive-section`, new modal for the form, single reusable lightbox for full-size image viewing.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script, Google Sheets, Google Drive. No test harness in this project — verification is manual via browser + Apps Script editor.

**Spec:** `docs/superpowers/specs/2026-04-20-saved-chats-design.md`

---

## File Structure

**Modify:**
- `apps-script/Code.gs` — add `getChats` + `addChat` handlers, wire into `doGet`/`doPost`
- `apps-script/SETUP.md` — add `Chats` tab columns to the setup steps
- `index.html` — add Saved Chats sub-section inside `#archive-section`, add `#chat-modal`, add `#lightbox`
- `style.css` — add dropzone, thumb, chat-card, chat-img, chat-text, chat-when, chat-notes, lightbox styles
- `app.js` — add `loadChats`, `renderChats`, `initChatForm`, `initLightbox`, paste/drop/picker handlers, `pendingImages` queue, wire into `init()` and `loadDashboard()`

**Unchanged:** existing Posts/Timeline/Countdown/Archive code, all assets.

---

## Task 1: Backend — `getChats` endpoint

**Files:**
- Modify: `apps-script/Code.gs`

Add the read endpoint. Reuses the existing `sheetToObjects` helper.

- [ ] **Step 1: Add `getChats` function to `Code.gs`**

Insert after the existing `getCountdown` function (around line 114):

```javascript
function getChats() {
  return sheetToObjects('Chats');
}
```

- [ ] **Step 2: Wire into `doGet`**

In `doGet` (around line 11-22), add a new case before `default`:

```javascript
case 'getChats':      return respond(getChats());
```

Final switch block should look like:

```javascript
switch (action) {
  case 'getPosts':      return respond(getPosts());
  case 'getTimeline':   return respond(getTimeline());
  case 'getCountdown':  return respond(getCountdown());
  case 'getChats':      return respond(getChats());
  default:              return respond({ error: 'Unknown action: ' + action });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): add getChats read endpoint"
```

---

## Task 2: Backend — `addChat` endpoint

**Files:**
- Modify: `apps-script/Code.gs`

Add the write endpoint. Validates at least one of `chat_text` or `images` is present. Iterates images, uploads each to Drive, joins URLs with commas.

- [ ] **Step 1: Add `addChat` function to `Code.gs`**

Insert after the existing `updateCountdown` function (around line 170), before the `uploadImage` helper:

```javascript
function addChat(params) {
  var author = params.author || '';
  var chatText = params.chat_text || '';
  var chatWhen = params.chat_when || '';
  var notes = params.notes || '';

  if (!author) {
    return { error: 'Author is required' };
  }

  var id = Utilities.getUuid();
  var imageUrls = '';

  if (params.images && params.images.length > 0) {
    var images;
    try {
      images = JSON.parse(params.images);
    } catch (e) {
      return { error: 'Invalid images payload' };
    }
    if (!Array.isArray(images)) images = [];
    var urls = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img || !img.data) continue;
      var mime = img.type || 'image/jpeg';
      urls.push(uploadImage(img.data, mime, id + '-' + i));
    }
    imageUrls = urls.join(',');
  }

  if (!chatText && !imageUrls) {
    return { error: 'Provide chat text or at least one screenshot' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chats');
  if (!sheet) {
    return { error: 'Chats tab not found in sheet' };
  }

  var savedDate = new Date().toISOString();
  sheet.appendRow([id, savedDate, author, chatText, imageUrls, chatWhen, notes]);
  return { success: true, id: id, saved_date: savedDate, image_urls: imageUrls };
}
```

- [ ] **Step 2: Wire into `doPost`**

In `doPost` (around line 25-36), add a case before `default`:

```javascript
case 'addChat':          result = addChat(e.parameter); break;
```

Final switch block should look like:

```javascript
switch (action) {
  case 'addPost':          result = addPost(e.parameter); break;
  case 'addTimeline':      result = addTimeline(e.parameter); break;
  case 'updateCountdown':  result = updateCountdown(e.parameter); break;
  case 'addChat':          result = addChat(e.parameter); break;
  default:                 result = { error: 'Unknown action: ' + action };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): add addChat write endpoint with multi-image support"
```

---

## Task 3: Update SETUP.md with Chats tab

**Files:**
- Modify: `apps-script/SETUP.md`

Document the new sheet tab so Brian knows to create it before deploying.

- [ ] **Step 1: Add Chats tab to the setup doc**

In `apps-script/SETUP.md`, find the section "## 2. Create Sheet Tabs" and the line `Create three tabs with these exact column headers in row 1:`. Change "three" to "four" and add a new table after the **Countdown** table, before the "Then add an initial countdown row" line.

Replace this line:
```
Create three tabs with these exact column headers in row 1:
```
with:
```
Create four tabs with these exact column headers in row 1:
```

Then, after the existing **Tab: Countdown** table block (which ends with a blank line before `Then add an initial countdown row (row 2) in the Countdown tab:`), insert:

```markdown
**Tab: Chats**

| A  | B          | C      | D         | E          | F         | G     |
|----|------------|--------|-----------|------------|-----------|-------|
| id | saved_date | author | chat_text | image_urls | chat_when | notes |

```

- [ ] **Step 2: Add redeployment reminder**

At the end of the `## Redeploying After Changes` section (after step 4), add:

```markdown

**Note:** After adding the Chats endpoints, the existing deployment URL still works — Apps Script routes new `action` values without a URL change. You only need to redeploy if you want your changes to be live.
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/SETUP.md
git commit -m "docs: add Chats tab to setup instructions"
```

---

## Task 4: HTML — Saved Chats sub-section inside Archive

**Files:**
- Modify: `index.html`

Nest the new sub-section inside `#archive-section`, between the hardcoded "Original Countdown" archive-entry and the dynamic `#archive-posts` container.

- [ ] **Step 1: Insert sub-section markup**

In `index.html`, find the closing `</div>` of the outer `.archive-entry` that contains "Original Countdown" (immediately before the `<!-- Archive posts from Google Sheet (type="archive") rendered here by JS -->` comment, around line 183). Immediately after that comment block and the `<div id="archive-posts"></div>` line, the structure should look like this. Locate this existing block:

```html
      <!-- Archive posts from Google Sheet (type="archive") rendered here by JS -->
      <div id="archive-posts"></div>
    </section>
```

Replace it with:

```html
      <!-- Archive posts from Google Sheet (type="archive") rendered here by JS -->
      <div id="archive-posts"></div>

      <!-- Saved Chats -->
      <div class="archive-entry">
        <div class="section-top">
          <h3 class="archive-heading">Saved Chats</h3>
          <button id="new-chat-btn" class="action-btn">+ Save Chat</button>
        </div>
        <div id="chats-list"></div>
        <div id="chats-loading" class="loader">Loading chats...</div>
        <p id="chats-empty" class="empty-msg hidden">No saved chats yet.</p>
        <p id="chats-error" class="error-msg hidden"></p>
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Open `index.html` locally (or the deployed site). Enter the password. Click "Archive" in the nav. Confirm the "Saved Chats" heading appears below the Original Countdown block, the "+ Save Chat" button is visible, and "Loading chats..." shows (it will stay showing until Task 7 wires up the JS — expected).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add Saved Chats sub-section inside Archive"
```

---

## Task 5: HTML — Chat modal

**Files:**
- Modify: `index.html`

Add the form modal for saving a new chat. Placed after the existing `countdown-modal`.

- [ ] **Step 1: Insert modal markup**

In `index.html`, find the closing `</div>` of the `#countdown-modal` (around line 272). Immediately after `</div>` of that modal (before `<script src="app.js"></script>`), insert:

```html
  <!-- Chat Modal -->
  <div id="chat-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>Save Chat</h3>
        <button class="modal-x" data-close="chat-modal">&times;</button>
      </div>
      <form id="chat-form">
        <label class="form-label">Author
          <input type="text" id="chat-author" class="form-input" required>
        </label>
        <label class="form-label">When did the chat take place? <span class="optional">(optional)</span>
          <input type="text" id="chat-when" class="form-input"
                 placeholder="e.g. Apr 15, 2026 8:30 PM or Spring 2025">
        </label>
        <label class="form-label">Screenshots <span class="optional">(click, paste, or drop)</span></label>
        <div id="chat-dropzone" class="chat-dropzone" tabindex="0">
          <p class="chat-dropzone-hint">Click to choose &middot; Ctrl/Cmd+V to paste &middot; or drag &amp; drop</p>
          <input type="file" id="chat-images" accept="image/*" multiple hidden>
          <div id="chat-thumbs" class="chat-thumbs"></div>
        </div>
        <label class="form-label">Chat text <span class="optional">(paste transcript)</span>
          <textarea id="chat-text" class="form-input form-textarea" rows="5"></textarea>
        </label>
        <label class="form-label">Notes <span class="optional">(optional)</span>
          <textarea id="chat-notes" class="form-input form-textarea" rows="2"></textarea>
        </label>
        <p id="chat-form-error" class="error-msg hidden"></p>
        <button type="submit" class="form-submit" id="chat-submit">Save Chat</button>
      </form>
    </div>
  </div>
```

- [ ] **Step 2: Verify modal markup**

Reload the site, open devtools console, run `document.getElementById('chat-modal')` — should return the element. The modal is hidden by default, so nothing visible yet.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add Save Chat modal form"
```

---

## Task 6: HTML — Lightbox overlay

**Files:**
- Modify: `index.html`

Single reusable lightbox for enlarging any screenshot in any chat card.

- [ ] **Step 1: Insert lightbox markup**

In `index.html`, after the `#chat-modal` block you just added, and before `<script src="app.js"></script>`, insert:

```html
  <!-- Lightbox -->
  <div id="lightbox" class="lightbox hidden">
    <img id="lightbox-img" alt="">
  </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(ui): add lightbox overlay markup"
```

---

## Task 7: CSS — Chat card + sub-section styles

**Files:**
- Modify: `style.css`

Styles for chat cards, text blocks, metadata, and stacked images. Matches the existing dark + rose/mauve theme.

- [ ] **Step 1: Append chat card styles**

Append to the end of `style.css`:

```css
/* --- Saved Chats --- */
.chat-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #2a1f3d;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.chat-card .post-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #b8b0a8;
  margin-bottom: 6px;
}
.chat-when {
  font-style: italic;
  font-size: 12px;
  color: #7f8c9b;
  margin-bottom: 12px;
}
.chat-images {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.chat-img {
  width: 100%;
  border-radius: 8px;
  cursor: zoom-in;
}
.chat-text {
  background: rgba(0, 0, 0, 0.25);
  border-left: 3px solid #c782af;
  padding: 10px 12px;
  border-radius: 4px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #e8e4df;
  margin-bottom: 12px;
}
.chat-notes {
  font-style: italic;
  font-size: 13px;
  color: #9a9289;
}
.chat-notes::before {
  content: 'Notes: ';
  color: #7f8c9b;
  font-style: normal;
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "style: add chat card styles"
```

---

## Task 8: CSS — Dropzone + thumbnail styles

**Files:**
- Modify: `style.css`

Styles for the modal's screenshot input area (dropzone + thumbnail previews with remove button).

- [ ] **Step 1: Append dropzone styles**

Append to the end of `style.css`:

```css
/* --- Chat Dropzone --- */
.chat-dropzone {
  border: 2px dashed #2a1f3d;
  border-radius: 8px;
  padding: 20px 16px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin-bottom: 16px;
  outline: none;
}
.chat-dropzone:hover,
.chat-dropzone:focus,
.chat-dropzone.drag-over {
  border-color: #c782af;
  background: rgba(199, 130, 175, 0.06);
}
.chat-dropzone-hint {
  font-size: 12px;
  color: #7f8c9b;
  text-align: center;
  margin: 0 0 8px 0;
}
.chat-dropzone-hint:last-child {
  margin-bottom: 0;
}
.chat-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.chat-thumbs:empty { margin-top: 0; }
.chat-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #2a1f3d;
}
.chat-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.chat-thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(10, 10, 15, 0.85);
  color: #e8e4df;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.chat-thumb-remove:hover {
  background: #e85d75;
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "style: add chat dropzone and thumbnail styles"
```

---

## Task 9: CSS — Lightbox styles

**Files:**
- Modify: `style.css`

Append to the end of `style.css`:

- [ ] **Step 1: Append lightbox styles**

```css
/* --- Lightbox --- */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}
.lightbox.hidden { display: none; }
.lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "style: add lightbox overlay styles"
```

---

## Task 10: JS — `loadChats` and `renderChats`

**Files:**
- Modify: `app.js`

Read path first — fetch chats, render card per entry. Empty/error states match the Posts/Timeline pattern.

- [ ] **Step 1: Add Chats section to `app.js`**

In `app.js`, find the end of the `// Timeline` section (right before the `// ============================================` line that starts the `// Archive Toggle` section, around line 455). Insert a new section:

```javascript
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
      if (urls.length) {
        html += '<div class="chat-images">';
        urls.forEach(function (u) {
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
```

- [ ] **Step 2: Wire `loadChats` into `loadDashboard`**

Find `loadDashboard` (around line 526):

```javascript
  function loadDashboard() {
    loadCountdown();
    loadPosts();
    loadTimeline();
  }
```

Change it to:

```javascript
  function loadDashboard() {
    loadCountdown();
    loadPosts();
    loadTimeline();
    loadChats();
  }
```

- [ ] **Step 3: Verify in browser**

Reload the site, log in, open Archive. Without any chats saved yet, the "No saved chats yet." message should appear under the "Saved Chats" heading. If Apps Script returns an error (e.g., Chats tab missing), "Could not load chats." should appear instead.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(chats): add read path — loadChats and renderChats"
```

---

## Task 11: JS — Chat form with file picker

**Files:**
- Modify: `app.js`

Wire up the modal, file picker, thumbnail previews, and submit handler. Paste and drag-drop come in the next task.

- [ ] **Step 1: Add `initChatForm` and helpers below the Chats section**

In `app.js`, immediately after the `createChatCard` function you added in Task 10, append:

```javascript
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
```

- [ ] **Step 2: Wire `initChatForm` into `init`**

Find the `init` function (around line 535):

```javascript
  function init() {
    initGate();
    initModals();
    initNav();
    initCountdownForm();
    initPostForm();
    initTimelineForm();
    initArchiveToggle();
    ...
```

Add `initChatForm();` right after `initTimelineForm();`:

```javascript
  function init() {
    initGate();
    initModals();
    initNav();
    initCountdownForm();
    initPostForm();
    initTimelineForm();
    initChatForm();
    initArchiveToggle();
    ...
```

- [ ] **Step 3: Verify in browser**

1. Open site, log in, go to Archive.
2. Click "+ Save Chat" — modal opens with author pre-filled if a previous post was made.
3. Click the dropzone — file dialog opens. Select 1-2 small images. Thumbnails appear with an × button.
4. Click × on a thumb — it removes from the list.
5. Try to submit with everything empty — inline error "Add chat text or at least one screenshot."
6. Add chat text + submit with no images — posts successfully, appears in the list, modal closes.
7. Add an image + no text — posts successfully, image appears stacked in the card.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(chats): add chat form with file picker and submit"
```

---

## Task 12: JS — Paste and drag-and-drop handlers

**Files:**
- Modify: `app.js`

Extend the dropzone to accept clipboard paste and drag-drop. Uses the same `addPendingImageFiles` from Task 11.

- [ ] **Step 1: Add paste + drag-drop listeners inside `initChatForm`**

In `app.js`, find `initChatForm`. After the `fileInput.addEventListener('change', ...)` block and before the `$('chat-form').addEventListener('submit', ...)` block, insert:

```javascript
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
```

- [ ] **Step 2: Verify in browser**

1. Open modal, take a screenshot (Win+Shift+S / Cmd+Ctrl+Shift+4 → copy). Press Ctrl/Cmd+V anywhere while modal is open — thumbnail appears.
2. Drag an image file from your OS file manager onto the dropzone — border highlights during hover, thumbnail appears on drop.
3. Combine all three (pick + paste + drop) in the same submission — all show as thumbnails; all upload.
4. Close modal without submitting, open again — `pendingImages` state is reset via `resetChatForm` (verify by inspecting `#chat-thumbs` is empty next open).

**Note:** `resetChatForm` is only called on successful submit. If user opens modal → adds images → closes → opens again, old thumbs still show. That's consistent with how the existing modals behave (form state persists until submit). Not a bug.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(chats): add clipboard paste and drag-and-drop for screenshots"
```

---

## Task 13: JS — Lightbox

**Files:**
- Modify: `app.js`

Click any screenshot in a chat card to enlarge. Click the overlay to close.

- [ ] **Step 1: Add `initLightbox`**

In `app.js`, after the `initChatForm` function and before the `// Archive Toggle` section comment, insert:

```javascript
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
```

- [ ] **Step 2: Wire into `init`**

In the `init` function, add `initLightbox();` after `initChatForm();`:

```javascript
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
    ...
```

- [ ] **Step 3: Verify in browser**

1. Open a chat card with at least one screenshot.
2. Click the screenshot — full-size overlay appears (dark backdrop, image centered, scaled to viewport).
3. Click anywhere on the overlay — it closes.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(chats): add lightbox for full-size screenshot viewing"
```

---

## Task 14: End-to-end verification

**Files:** none (manual QA)

Run through the full feature end-to-end to catch any integration bugs before wrapping up.

- [ ] **Step 1: Deploy Apps Script changes**

The frontend points at the existing Apps Script deployment URL. For the new `getChats` / `addChat` actions to work live:

1. Open the Google Sheet → Extensions > Apps Script.
2. Copy the full current contents of `apps-script/Code.gs` from this repo into the editor.
3. Ensure `DRIVE_FOLDER_ID` at the top is still set correctly.
4. Save (Ctrl+S).
5. Deploy > Manage deployments > pencil icon on the existing deployment > Version: **New version** > Deploy.
6. The existing URL is reused; no frontend config change needed.

- [ ] **Step 2: Create the Chats sheet tab**

In the Google Sheet, add a new tab named exactly `Chats`. Row 1 headers in columns A-G:

```
id | saved_date | author | chat_text | image_urls | chat_when | notes
```

- [ ] **Step 3: Smoke test from a fresh browser session**

1. Open the site in an incognito window → enter password → reach the dashboard.
2. Click "Archive" → confirm "Saved Chats" block is visible and "No saved chats yet." appears.
3. Click "+ Save Chat" → modal opens.
4. Fill in: Author "Brian", When "Apr 15, 2026 8:30 PM", paste ~3 lines of text into Chat text, add a note "test entry".
5. Add one image via file picker + one via paste (take a screenshot first) + one via drag-drop from desktop.
6. Submit → loading state → modal closes → chat card appears in the list with author, saved date, "Chat from:", 3 stacked screenshots, monospace text block, and "Notes: test entry".
7. Click any screenshot → lightbox opens → click to close.
8. Reload the page → chat persists (fetched from sheet).
9. Open the Google Sheet → `Chats` tab → row shows the UUID, ISO date, values, comma-separated Drive URLs.
10. Add a second chat with only images (no text). Submit → appears correctly.
11. Add a third chat with only text (no images). Submit → appears correctly.
12. Try to submit empty → inline error shows, nothing sent.

- [ ] **Step 4: Regression check**

1. Go back to Posts → create a normal post with image → still works.
2. Add a Timeline milestone → still works.
3. Edit the Countdown → still works.
4. Archive section still shows Original Countdown with Before/After toggle.

- [ ] **Step 5: Commit any fixes from verification**

If any bug was found and fixed, commit it. If everything passed, skip.

```bash
git add -A
git commit -m "fix(chats): <short description of fix>"
```

---

## Notes for the implementer

- **Apps Script deploy is a manual step** — Brian handles Google Sheet/Script himself, so Task 14 step 1-2 is his responsibility, but the plan documents it clearly.
- **No automated tests exist** in this repo. That's intentional — it's a static personal site. Don't add a test harness; match the existing pattern of manual browser verification.
- **Multi-image upload budget:** Apps Script caps POST payloads around 6 MB. Base64 inflates binary by ~33%, so practical ceiling is ~4 MB of raw image data per submission. Existing `apiPost` already uses 30s timeout when `image` or `images` is present (it just checks `payload.image`, so if you're feeling thorough, see optional refinement below). For now, large-batch uploads may time out silently — user retries with fewer/smaller screenshots.
- **Optional refinement (not required):** In `apiPost` (around line 126), the timeout check is:
  ```javascript
  var hasImage = payload.image && payload.image.length > 0;
  ```
  This is fine because `payload.images` is also non-empty when present, and both being truthy strings extend the timeout only when `payload.image` is set. If you want the longer timeout to apply to chat submissions too, change to:
  ```javascript
  var hasImage = (payload.image && payload.image.length > 0) ||
                 (payload.images && payload.images.length > 0);
  ```
  If you make this change, do it as a separate commit under Task 11.
