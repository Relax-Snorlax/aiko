# Edit & Delete Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in user edit or delete Posts, Saved Chats, and Timeline milestones via a pencil icon on each card that opens the existing "New" modal in edit mode (with a Delete button).

**Architecture:** Reuse the three existing modals in two modes (create/edit) driven by module-scoped `editing*Id` state vars. Generic backend endpoints `editEntry` and `deleteEntry` update any row by `id` column, with a small allowlist per sheet. Timeline sheet gets a new `id` column (one-time migration + backfill).

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script, Google Sheets, Google Drive.

**Spec:** `docs/superpowers/specs/2026-04-20-edit-delete-entries-design.md`

---

## File Structure

**Modify:**
- `apps-script/Code.gs` — add `EDITABLE_SHEETS`, `editEntry`, `deleteEntry`, `backfillTimelineIds`; update `addTimeline` + `getTimeline`; wire cases into `doPost`.
- `apps-script/SETUP.md` — update Timeline schema (4 cols with `id`), add backfill instructions.
- `index.html` — add Delete button + current-image preview block to Post/Chat/Timeline modals.
- `style.css` — add `.edit-btn`, `.form-delete`, `.post-current-image` styles + `position:relative` for cards.
- `app.js` — add pencil in each card builder; add edit/open/reset/delete logic for Posts/Chats/Timeline; edit-click delegate; extend `renderChatThumbs` to show kept URLs.

**Unchanged:** Countdown (own endpoint), Archive Original Countdown tile (hardcoded), Saved Chats read path, Posts read path.

---

## Task 1: Backend — Timeline id migration helpers

**Files:**
- Modify: `apps-script/Code.gs`

Prepare the backend to read/write the new `id` column on Timeline, and provide a one-shot backfill for existing rows.

- [ ] **Step 1: Update `addTimeline` in `Code.gs`**

Find the existing function (around line 142):

```javascript
function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  sheet.appendRow([params.date, params.title, params.description || '']);
  return { success: true };
}
```

Replace with:

```javascript
function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var id = Utilities.getUuid();
  sheet.appendRow([id, params.date, params.title, params.description || '']);
  return { success: true, id: id };
}
```

- [ ] **Step 2: Update `getTimeline` header list**

Find the existing function (around line 75):

```javascript
function getTimeline() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  var headers = ['date', 'title', 'description'];
  var startRow = (data[0][0] === 'date') ? 1 : 0;

  return data.slice(startRow).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : (row[i] || '');
    });
    return obj;
  });
}
```

Replace with:

```javascript
function getTimeline() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  var headers = ['id', 'date', 'title', 'description'];
  var startRow = (data[0][0] === 'id') ? 1 : 0;

  return data.slice(startRow).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : (row[i] || '');
    });
    return obj;
  });
}
```

- [ ] **Step 3: Add `backfillTimelineIds` helper**

Add this function anywhere in `Code.gs` (recommended: right after `getTimeline`):

```javascript
function backfillTimelineIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  if (!sheet) return { error: 'Timeline tab not found' };
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return { filled: 0 };
  var startRow = (data[0][0] === 'id') ? 1 : 0;
  var filled = 0;
  for (var r = startRow; r < data.length; r++) {
    if (!data[r][0]) {
      sheet.getRange(r + 1, 1).setValue(Utilities.getUuid());
      filled++;
    }
  }
  return { filled: filled };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): prepare Timeline id column and backfill helper"
```

---

## Task 2: Backend — Generic editEntry endpoint

**Files:**
- Modify: `apps-script/Code.gs`

Add the allowlist constant and `editEntry` function that updates any row by id.

- [ ] **Step 1: Add `EDITABLE_SHEETS` constant near the top of the file**

Insert after the `DRIVE_FOLDER_ID` line (around line 7):

```javascript
var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description']
};
```

- [ ] **Step 2: Add `editEntry` function**

Add right before the existing `uploadImage` function (around line 220+, after `addChat`):

```javascript
function editEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  var allowed = EDITABLE_SHEETS[sheetName];
  if (!allowed) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) { rowIndex = r; break; }
  }
  if (rowIndex < 0) return { error: 'Entry not found' };

  // Fresh image uploads (Posts single, Chats multi).
  var newImageUrls = null;
  if (sheetName === 'Posts' && params.image && params.image.length > 0) {
    var mime = params.image_type || 'image/jpeg';
    newImageUrls = uploadImage(params.image, mime, id + '-edit-' + Date.now());
  }
  if (sheetName === 'Chats' && params.images && params.images.length > 0) {
    var images;
    try { images = JSON.parse(params.images); } catch (e) { return { error: 'Invalid images payload' }; }
    var urls = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img || !img.data) continue;
      var mime2 = img.type || 'image/jpeg';
      urls.push(uploadImage(img.data, mime2, id + '-edit-' + Date.now() + '-' + i));
    }
    var kept = params.image_urls ? String(params.image_urls).split(',').filter(Boolean) : [];
    newImageUrls = kept.concat(urls).join(',');
  }

  // Apply allowlist edits (only fields the client explicitly sent).
  allowed.forEach(function (field) {
    if (params[field] === undefined) return;
    var colIndex = headers.indexOf(field);
    if (colIndex < 0) return;
    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(params[field]);
  });

  // Apply computed image URL AFTER allowlist so fresh uploads win.
  if (newImageUrls !== null) {
    var imgField = (sheetName === 'Posts') ? 'image_url' : 'image_urls';
    var imgCol = headers.indexOf(imgField);
    if (imgCol >= 0) sheet.getRange(rowIndex + 1, imgCol + 1).setValue(newImageUrls);
  }

  return { success: true, id: id };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): add generic editEntry endpoint with image upload support"
```

---

## Task 3: Backend — deleteEntry + doPost wiring

**Files:**
- Modify: `apps-script/Code.gs`

- [ ] **Step 1: Add `deleteEntry` function**

Insert right after `editEntry`:

```javascript
function deleteEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  if (!EDITABLE_SHEETS[sheetName]) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: 'Entry not found' };
}
```

- [ ] **Step 2: Wire both endpoints into `doPost`**

Find `doPost` (around line 25). Add two new cases before `default`:

```javascript
case 'editEntry':     result = editEntry(e.parameter); break;
case 'deleteEntry':   result = deleteEntry(e.parameter); break;
```

The final switch should read:

```javascript
switch (action) {
  case 'addPost':          result = addPost(e.parameter); break;
  case 'addTimeline':      result = addTimeline(e.parameter); break;
  case 'updateCountdown':  result = updateCountdown(e.parameter); break;
  case 'addChat':          result = addChat(e.parameter); break;
  case 'editEntry':        result = editEntry(e.parameter); break;
  case 'deleteEntry':      result = deleteEntry(e.parameter); break;
  default:                 result = { error: 'Unknown action: ' + action };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat(apps-script): add deleteEntry endpoint and wire editEntry/deleteEntry"
```

---

## Task 4: SETUP.md — Timeline schema + backfill instructions

**Files:**
- Modify: `apps-script/SETUP.md`

- [ ] **Step 1: Update Timeline schema table**

Find this block in `apps-script/SETUP.md`:

```markdown
**Tab: Timeline**

| A    | B     | C           |
|------|-------|-------------|
| date | title | description |
```

Replace with:

```markdown
**Tab: Timeline**

| A  | B    | C     | D           |
|----|------|-------|-------------|
| id | date | title | description |
```

- [ ] **Step 2: Add one-time migration note**

Append this section at the end of `apps-script/SETUP.md` (below the Redeploying section):

```markdown

## One-Time Migration for Edit/Delete on Timeline

If you're upgrading from the earlier 3-column Timeline:

1. Insert a new column to the left of column A in the Timeline tab. The first row becomes `id | date | title | description`.
2. In the Apps Script editor, select `backfillTimelineIds` from the function dropdown and click Run. It assigns a UUID to every existing row that lacks one.
3. You only need to run this once. New rows created via the site will include an id automatically.
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/SETUP.md
git commit -m "docs: update Timeline schema and add backfill migration note"
```

---

## Task 5: HTML — Delete buttons + Post image preview

**Files:**
- Modify: `index.html`

Add a Delete button to each of the three editable modals, and a current-image preview block to the Post modal.

- [ ] **Step 1: Add Post modal — current-image preview + Delete button**

Find the Post modal form. Locate this line:

```html
        <label class="form-label">Photo <span class="optional">(optional)</span>
          <input type="file" id="post-image" class="form-input" accept="image/*">
        </label>
```

Replace it with:

```html
        <div id="post-current-image" class="post-current-image hidden">
          <img id="post-current-image-img" alt="Current image">
          <button type="button" class="post-remove-img" id="post-remove-img-btn">Remove current image</button>
        </div>
        <label class="form-label">Photo <span class="optional">(optional)</span>
          <input type="file" id="post-image" class="form-input" accept="image/*">
        </label>
```

Then find the submit button in the Post modal:

```html
        <button type="submit" class="form-submit" id="post-submit">Post</button>
```

Insert a Delete button BEFORE it:

```html
        <button type="button" class="form-delete hidden" id="post-delete-btn">Delete</button>
        <button type="submit" class="form-submit" id="post-submit">Post</button>
```

- [ ] **Step 2: Add Chat modal — Delete button**

Find the Chat modal submit button:

```html
        <button type="submit" class="form-submit" id="chat-submit">Save Chat</button>
```

Insert a Delete button BEFORE it:

```html
        <button type="button" class="form-delete hidden" id="chat-delete-btn">Delete</button>
        <button type="submit" class="form-submit" id="chat-submit">Save Chat</button>
```

- [ ] **Step 3: Add Timeline modal — Delete button**

Find the Timeline modal submit button:

```html
        <button type="submit" class="form-submit" id="tl-submit">Add Milestone</button>
```

Insert a Delete button BEFORE it:

```html
        <button type="button" class="form-delete hidden" id="tl-delete-btn">Delete</button>
        <button type="submit" class="form-submit" id="tl-submit">Add Milestone</button>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): add Delete buttons and Post current-image preview to modals"
```

---

## Task 6: CSS — Edit pencil, Delete button, and image preview

**Files:**
- Modify: `style.css`

Append to the end of `style.css`:

- [ ] **Step 1: Append styles**

```css
/* --- Edit/Delete --- */
.post-card, .chat-card, .tl-item { position: relative; }

.edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #7f8c9b;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
}
.edit-btn:hover {
  color: #c782af;
  background: rgba(199, 130, 175, 0.08);
}

.form-delete {
  background: transparent;
  color: #e85d75;
  border: 1px solid #e85d75;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 8px;
  transition: background 0.2s, color 0.2s;
}
.form-delete:hover {
  background: #e85d75;
  color: #0a0a0f;
}

.post-current-image {
  margin-bottom: 12px;
}
.post-current-image img {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 6px;
}
.post-remove-img {
  background: transparent;
  color: #e85d75;
  border: 1px solid #2a1f3d;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.post-remove-img:hover {
  border-color: #e85d75;
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "style: add edit pencil, delete button, and image preview styles"
```

---

## Task 7: JS — Pencil icon on every card + edit-click delegate

**Files:**
- Modify: `app.js`

Three card builders get a pencil; a single delegate in `init` routes clicks to the right opener.

- [ ] **Step 1: Update `createPostCard` to include the pencil**

Find the current function (around line 320):

```javascript
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
```

Replace with:

```javascript
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
```

- [ ] **Step 2: Update `createChatCard` to include the pencil**

Find the function (around line 488). The current first line inside the function builds `html` starting with `<div class="post-meta">...`. Insert the pencil as the very first thing in the HTML. Find this:

```javascript
    var html = '<div class="post-meta">' +
      '<span class="post-author">' + escHtml(c.author) + '</span>' +
      '<span class="post-date">saved ' + formatDate(c.saved_date) + '</span>' +
      '</div>';
```

Replace with:

```javascript
    var html = '<button class="edit-btn" data-id="' + escHtml(c.id) + '" data-type="chat" title="Edit">&#9998;</button>' +
      '<div class="post-meta">' +
      '<span class="post-author">' + escHtml(c.author) + '</span>' +
      '<span class="post-date">saved ' + formatDate(c.saved_date) + '</span>' +
      '</div>';
```

- [ ] **Step 3: Update `renderTimeline` to include the pencil**

Find the function (around line 406):

```javascript
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
```

Replace with:

```javascript
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
```

The `entry.id ? ... : ''` guard means timeline rows without an id (pre-backfill) simply don't get a pencil. Users will need to run the migration to edit old rows.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(edit): add pencil icon to Post, Chat, and Timeline cards"
```

---

## Task 8: JS — Posts edit wiring (state, open, submit branch, delete, reset)

**Files:**
- Modify: `app.js`

This is the largest task. It adds `editingPostId` state, `postImageRemoved` flag, `openEditPost`, `resetPostForm`, updates the submit handler, adds the delete button, and keeps an in-memory `lastPosts` array for lookups.

- [ ] **Step 1: Keep posts in memory for edit lookup**

Find `loadPosts` (around line 272):

```javascript
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
```

Introduce a module-scoped array. Near the top of the Posts section (just above `loadPosts`), add:

```javascript
  var lastPosts = [];
```

Then in `loadPosts`, right after receiving the `posts` array, store it. Change the `.then(function (posts) {` block to:

```javascript
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
```

- [ ] **Step 2: Replace `initPostForm` and add edit helpers**

Find the full `initPostForm` function (around line 338). Delete it entirely. In its place, insert the following block — it contains three module-scoped vars, three new helper functions, and a replacement `initPostForm`. All of these sit at the same indentation level (inside the IIFE, not nested in another function).

```javascript
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
      var saved = getCookie(CONFIG.AUTHOR_COOKIE);
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
```

- [ ] **Step 3: Hook modal close to `resetPostForm`**

Find `initModals` (around line 480):

```javascript
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
```

Add a post-close hook. Replace with:

```javascript
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
  }
```

(The function-existence checks matter because `resetChatForm` and `resetTimelineForm` won't exist until Tasks 9 and 10 add them. This task only defines `resetPostForm`, so `typeof` guards prevent ReferenceErrors during the transitional commits.)

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(edit): Posts edit/delete with reusable modal and image handling"
```

---

## Task 9: JS — Chats edit wiring (state, open, submit branch, delete, reset)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Keep chats in memory for lookup**

Find `loadChats` (around line 460). Add a module-scoped `lastChats = []` near the top of the Chats section:

```javascript
  var lastChats = [];
```

In `loadChats`, in the success `.then` handler, add the store right after the `chats.error` check block, BEFORE the empty-array check:

```javascript
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
```

- [ ] **Step 2: Add `keptImageUrls` + update `renderChatThumbs`**

Find the existing `pendingImages` declaration (around line 522). Add alongside:

```javascript
  var pendingImages = [];
  var keptImageUrls = [];
```

Replace `renderChatThumbs` with a version that renders both kept server URLs and pending files:

```javascript
  function renderChatThumbs() {
    var container = $('chat-thumbs');
    container.innerHTML = '';

    keptImageUrls.forEach(function (url, idx) {
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
        keptImageUrls.splice(idx, 1);
        renderChatThumbs();
      });
      wrap.appendChild(img);
      wrap.appendChild(btn);
      container.appendChild(wrap);
    });

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
```

- [ ] **Step 3: Extend `resetChatForm` to reset `keptImageUrls` too**

Find `resetChatForm`:

```javascript
  function resetChatForm() {
    pendingImages = [];
    renderChatThumbs();
    $('chat-form').reset();
    hide($('chat-form-error'));
  }
```

Replace with:

```javascript
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
```

- [ ] **Step 4: Add `editingChatId` + `openEditChat`**

Add right after `keptImageUrls` declaration:

```javascript
  var editingChatId = null;

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
```

- [ ] **Step 5: Update chat form submit to branch on editing mode + wire delete**

Find the chat form submit handler inside `initChatForm` (around line 620). Locate the existing submit listener:

```javascript
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
```

Replace with:

```javascript
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
```

Then, at the end of `initChatForm` (just before the closing `}` of the function), add the delete handler:

```javascript
    $('chat-delete-btn').addEventListener('click', function () {
      if (!editingChatId) return;
      if (!confirm('Delete this chat permanently?')) return;
      apiPost({ action: 'deleteEntry', sheet: 'Chats', id: editingChatId })
        .then(function () { closeModal('chat-modal'); resetChatForm(); loadChats(); })
        .catch(function () { alert('Failed to delete. Please try again.'); });
    });
```

- [ ] **Step 6: Reset form when user clicks "+ Save Chat"**

Find the existing:

```javascript
    $('new-chat-btn').addEventListener('click', function () {
      var saved = getCookie(CONFIG.AUTHOR_COOKIE);
      if (saved) $('chat-author').value = saved;
      openModal('chat-modal');
    });
```

Replace with:

```javascript
    $('new-chat-btn').addEventListener('click', function () {
      resetChatForm();
      var saved = getCookie(CONFIG.AUTHOR_COOKIE);
      if (saved) $('chat-author').value = saved;
      openModal('chat-modal');
    });
```

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat(edit): Chats edit/delete with kept+new image thumbs"
```

---

## Task 10: JS — Timeline edit wiring (state, open, submit branch, delete, reset)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Keep timeline entries in memory**

Find `loadTimeline` (around line 386). Add module-scoped var near the top of the Timeline section:

```javascript
  var lastTimeline = [];
```

In `loadTimeline`, after receiving entries, store them. Modify:

```javascript
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
```

Replace with:

```javascript
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
```

- [ ] **Step 2: Replace `initTimelineForm` and add edit helpers**

Find the full existing `initTimelineForm` function. Delete it entirely. In its place, insert the following block — one module-scoped var, two helper functions, and the replacement `initTimelineForm`. All at the same indentation level (inside the IIFE).

```javascript
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
    // HTML date input needs YYYY-MM-DD; slice ISO strings safely.
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
          date: $('tl-date').value,
          title: $('tl-title').value,
          description: $('tl-desc').value
        };
      }
      apiPost(payload).then(done).catch(fail);
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(edit): Timeline edit/delete with reusable modal"
```

---

## Task 11: JS — Wire the edit-click delegate

**Files:**
- Modify: `app.js`

A single document-level click delegate routes pencil clicks to the right opener.

- [ ] **Step 1: Add a new init function and wire into `init()`**

Add this function anywhere in the IIFE (recommended: just before the `init()` function, around line 780):

```javascript
  function initEditDelegate() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.edit-btn') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var type = btn.getAttribute('data-type');
      if (type === 'post') openEditPost(id);
      else if (type === 'chat') openEditChat(id);
      else if (type === 'timeline') openEditTimeline(id);
    });
  }
```

Find the existing `init()` function and insert `initEditDelegate();` right after `initLightbox();`:

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
    initEditDelegate();

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add app.js
git commit -m "feat(edit): wire edit-click delegate to open post/chat/timeline editors"
```

---

## Task 12: End-to-end verification

**Files:** none (manual QA)

- [ ] **Step 1: Deploy Apps Script changes**

User must:
1. Open the Google Sheet → Extensions → Apps Script.
2. Copy the current `apps-script/Code.gs` from repo into the editor, save.
3. Deploy → Manage deployments → pencil → Version: New version → Deploy.

- [ ] **Step 2: Timeline migration**

1. In the Google Sheet, Timeline tab: insert a new column to the left of column A. Type `id` into row 1 column A. Existing data should now be in columns B-D.
2. In the Apps Script editor, pick `backfillTimelineIds` from the function dropdown. Click Run. Authorize if prompted. It returns `{filled: N}` in the execution log.

- [ ] **Step 3: Full smoke test from fresh browser session**

1. Open the site in incognito, enter password.
2. Posts: create a new post with image. Click pencil on your post → modal opens with fields pre-filled, title says "Edit Post", button says "Save Changes", Delete button visible. Change the body text, submit. Card updates on reload.
3. Posts: edit again. Click "Remove current image" → preview hides. Pick a new file. Submit. Card should show the new image.
4. Posts: edit again. Click Delete → confirm → card disappears.
5. Saved Chats: create a new chat with 2 images + text. Click pencil. Thumbs show existing images. Click × on one thumb to remove it. Drag/paste/pick a new image. Change the notes. Submit. Card reloads with (1 kept + 1 new) = 2 images and updated notes.
6. Saved Chats: delete via modal.
7. Timeline: edit a milestone. Confirm date/title/description pre-fill. Change one, save. Confirm update.
8. Timeline: delete. Confirm removal.
9. Create another post and chat — confirm the regular (non-edit) flow still works and modal resets.
10. Close modal with × and backdrop click — confirm form resets each time (next open starts fresh).

- [ ] **Step 4: Commit fix if anything found**

If anything broke, fix and commit as `fix(edit): <description>`. Otherwise no commit.

---

## Notes for the implementer

- **Branching uses `var` and `function` scoping (ES5)** — match existing file style.
- **`typeof` guards in `resetFormForModal`** are intentional — they let each task land independently without breaking the build between Task 8 and Tasks 9/10.
- **Timeline rows without `id`** skip the pencil rendering. Once the user runs the backfill, they all get pencils on next reload.
- **Delete leaves Drive files orphaned** — this is accepted per the spec's "Out of Scope".
- **`apiPost` timeout** — already covers both `image` and `images` after the Saved Chats work; no change needed here.
- **No test harness** — manual verification only. Follow the same pattern established by Saved Chats and the dedicated countdown page.
