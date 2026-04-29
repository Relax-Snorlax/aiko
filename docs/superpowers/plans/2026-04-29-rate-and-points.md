# Rate Your Partner + Points & Avatar Tiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a partner-to-partner rating system, a points ledger with per-action 3-hour cooldowns, and a stats footer with manga-aura tier borders that level up at 5 / 20 / 50 / 100 / 150 / 250 / 500 / 1000 points.

**Architecture:** New `Feedback` and `Points` sheets in the existing Google Sheet. Apps Script gains `awardPointsIfEligible` (cooldown helper, server-side, `LockService` guarded), `addFeedback` / `getFeedback` / `getStats` endpoints, and registers `Feedback` for edit/delete. Frontend gains a new "Feedback" section, a glowing Rate button (time-boxed 14 days), CRUD JS for feedback, and a stats footer that replaces the current footer with two avatar cards (Brian + Linh) showing points + average hearts inside progressively richer manga-aura borders.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script, Google Sheets, Google Drive.

**Spec:** `docs/superpowers/specs/2026-04-29-rate-and-points-design.md`

**Testing:** No automated test framework. Verification is manual in the browser. Each task ends with a concrete in-browser smoke check before commit.

---

## File Structure

**Create:**
- `assets/ren-avatar.png` — square portrait for Ren, cropped from `ren-aiko-portraits.png`
- `assets/aiko-avatar.png` — square portrait for Aiko, same source

**Modify:**
- `apps-script/Code.gs` — add `ensureSheet`, `awardPointsIfEligible`, `addFeedback`, `getFeedback`, `getStats`; wire points into `addPost` / `addChat` / `addTimeline`; register `Feedback` in `EDITABLE_SHEETS`; route new actions in `doGet` / `doPost`.
- `index.html` — new nav link, `#feedback-section`, `#feedback-modal`; replace `<footer>` with stats footer markup.
- `app.js` — add `CONFIG.FEATURE_LAUNCH` / `CONFIG.GLOW_DAYS`; pass `user` on existing writes; add `loadFeedback` / `renderFeedback` / `createFeedbackCard` / `initFeedbackForm` / `openEditFeedback` / `resetFeedbackForm`; add stats fetcher + tier mapping + glow init; extend `initEditDelegate` for `type === 'feedback'`; call new init in `init()` and load in `loadDashboard()`.
- `style.css` — add `.feedback-card`, `.fb-meta`, `.fb-hearts`, `.fb-comment`, `.heart-picker`, `.glow-new`, `.stats-footer`, `.stats-card`, `.stats-avatar`, `.tier-0` through `.tier-8`.

**Unchanged:** Countdown, Archive Original Countdown tile, Saved Chats schema, Posts schema, two-password gate, login log.

---

## Task 1: Crop and commit avatar portraits

**Files:**
- Create: `assets/ren-avatar.png`, `assets/aiko-avatar.png`
- Source: `assets/ren-aiko-portraits.png` (1536×1024)

The source image is a wide composition with both characters. Crop two square portraits — left half for Ren, right half for Aiko — and downscale to 512×512 for reasonable file size. The avatar circle on screen is ~96px so 512×512 is plenty.

- [ ] **Step 1: Confirm character positions in the source**

Open `assets/ren-aiko-portraits.png` in any viewer and confirm Ren is on the left, Aiko on the right. If reversed, swap the crop boxes in step 2.

- [ ] **Step 2: Crop with Python+Pillow**

Run from the repo root:

```bash
python3 - <<'PY'
from PIL import Image
src = Image.open('assets/ren-aiko-portraits.png')  # 1536x1024
# Take a 1024x1024 square from each side (centered vertically), then downscale
left  = src.crop((0,    0, 1024, 1024)).resize((512, 512), Image.LANCZOS)
right = src.crop((512,  0, 1536, 1024)).resize((512, 512), Image.LANCZOS)
left.save('assets/ren-avatar.png',  optimize=True)
right.save('assets/aiko-avatar.png', optimize=True)
print('done')
PY
```

Expected: prints `done`. Two new files appear under `assets/`.

- [ ] **Step 3: Eyeball the crops**

Open both PNGs. If a face is cut off, tweak the crop offsets and re-run. The face/head should sit roughly centered.

- [ ] **Step 4: Commit**

```bash
git -C /home/brian/Websites add assets/ren-avatar.png assets/aiko-avatar.png
git -C /home/brian/Websites commit -m "feat(assets): add ren and aiko avatar portraits

Cropped from ren-aiko-portraits.png to 512x512 squares for use in the
upcoming stats footer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — `ensureSheet` helper

**Files:**
- Modify: `apps-script/Code.gs`

A small helper that returns a sheet by name, creating it with header row if missing. Used by both `Feedback` and `Points` sheets so we don't require manual setup.

- [ ] **Step 1: Add `ensureSheet` near the top of `Code.gs`**

Insert after the `EDITABLE_SHEETS` declaration (around line 13, before `// --- Entry Points ---`):

```javascript
// Returns the sheet by name. Creates it (with the given header row) if missing.
// Uses script lock so two simultaneous callers can't both create the same sheet.
function ensureSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    return sheet;
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Manual sanity check from the Apps Script editor**

Open the Apps Script editor (Extensions → Apps Script). Save. Reload. The script should compile with no errors. Don't invoke yet — Task 3 will use it.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): add ensureSheet helper for auto-creating sheets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — `awardPointsIfEligible` cooldown helper

**Files:**
- Modify: `apps-script/Code.gs`

Single source of truth for the 3-hour-per-action cooldown. Looks up the most recent Points row for `(user, action_type)`, and either appends a new row (returning `{amount: 5, awarded: true}`) or returns `null` if on cooldown. Wrapped in a script lock so concurrent callers can't both pass the cooldown check.

- [ ] **Step 1: Add constants and helper to `Code.gs`**

Insert below the new `ensureSheet` function:

```javascript
var POINTS_HEADERS = ['id', 'date', 'user', 'action_type', 'source_id', 'amount'];
var FEEDBACK_HEADERS = ['id', 'date', 'author', 'target', 'hearts', 'comment'];
var COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
var POINTS_PER_ACTION = 5;
var VALID_USERS = ['Brian', 'Linh'];

function isValidUser(u) {
  return VALID_USERS.indexOf(u) >= 0;
}

function awardPointsIfEligible(user, action_type, source_id) {
  if (!isValidUser(user)) return null;

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = ensureSheet('Points', POINTS_HEADERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var userCol = headers.indexOf('user');
    var actionCol = headers.indexOf('action_type');
    var dateCol = headers.indexOf('date');

    var now = Date.now();
    var mostRecent = 0;
    for (var r = 1; r < data.length; r++) {
      if (data[r][userCol] === user && data[r][actionCol] === action_type) {
        var ts = new Date(data[r][dateCol]).getTime();
        if (!isNaN(ts) && ts > mostRecent) mostRecent = ts;
      }
    }

    if (mostRecent && (now - mostRecent) < COOLDOWN_MS) {
      return null; // on cooldown
    }

    var id = Utilities.getUuid();
    var dateIso = new Date().toISOString();
    sheet.appendRow([id, dateIso, user, action_type, source_id || '', POINTS_PER_ACTION]);
    return { amount: POINTS_PER_ACTION, awarded: true };
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Save in the Apps Script editor**

Confirm the script compiles.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): add awardPointsIfEligible cooldown helper

3-hour per-(user, action_type) cooldown. LockService-guarded so the
read-then-append sequence is atomic across concurrent invocations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backend — wire points into existing add endpoints

**Files:**
- Modify: `apps-script/Code.gs`

Each existing `addPost` / `addChat` / `addTimeline` accepts a `user` parameter (canonical user) and calls `awardPointsIfEligible` after appending its row. The return shape gains `points_awarded: 5 | 0`.

- [ ] **Step 1: Update `addPost` (around line 151)**

Replace the existing function body with:

```javascript
function addPost(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Posts');
  var id = Utilities.getUuid();
  var date = new Date().toISOString();
  var imageUrl = '';

  if (params.image && params.image.length > 0) {
    var mimeType = params.image_type || 'image/jpeg';
    imageUrl = uploadImage(params.image, mimeType, id);
  }

  sheet.appendRow([
    id, date, params.author || '', params.title || '',
    params.body || '', imageUrl, params.type || 'post'
  ]);

  var award = awardPointsIfEligible(params.user, 'post', id);
  return {
    success: true, id: id, date: date, image_url: imageUrl,
    points_awarded: award ? award.amount : 0
  };
}
```

- [ ] **Step 2: Update `addTimeline` (around line 169)**

Replace:

```javascript
function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var id = Utilities.getUuid();
  sheet.appendRow([id, params.date, params.title, params.description || '']);
  var award = awardPointsIfEligible(params.user, 'timeline', id);
  return { success: true, id: id, points_awarded: award ? award.amount : 0 };
}
```

- [ ] **Step 3: Update `addChat` (around line 206)**

Find the final `return` line near the end of the function:

```javascript
  var savedDate = new Date().toISOString();
  sheet.appendRow([id, savedDate, author, chatText, imageUrls, chatWhen, notes]);
  return { success: true, id: id, saved_date: savedDate, image_urls: imageUrls };
}
```

Replace with:

```javascript
  var savedDate = new Date().toISOString();
  sheet.appendRow([id, savedDate, author, chatText, imageUrls, chatWhen, notes]);
  var award = awardPointsIfEligible(params.user, 'chat', id);
  return {
    success: true, id: id, saved_date: savedDate, image_urls: imageUrls,
    points_awarded: award ? award.amount : 0
  };
}
```

- [ ] **Step 4: Save and deploy**

In the Apps Script editor: Save → Deploy → Manage deployments → choose the existing deployment → New version. The new code goes live at the same `SCRIPT_URL`.

- [ ] **Step 5: Smoke check from the deployed URL**

Open the live site, log in, post something. Open the Google Sheet → Points tab should appear (auto-created) with one row: `(uuid, ISO-now, Brian|Linh, post, post-id, 5)`.

If no Points row appears: confirm the cookie has the canonical user. In the browser DevTools: `document.cookie` should include `ren-aiko-user=Brian` or `ren-aiko-user=Linh`. (Wiring the `user` parameter on the client comes in Task 9; for this task it's expected the param is missing and **no points are awarded yet** — that's a valid pass too.)

- [ ] **Step 6: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): award points on add for posts, chats, milestones

Each add endpoint now accepts a canonical 'user' param and calls
awardPointsIfEligible. Returns points_awarded (0 or 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Backend — Feedback endpoints

**Files:**
- Modify: `apps-script/Code.gs`

`addFeedback` writes to the Feedback sheet (auto-creates) with author = canonical user, target = the *other* canonical user. Awards 5 points (cooldown applies). `getFeedback` returns all rows.

- [ ] **Step 1: Add the endpoint functions**

Insert after `addChat` (around line 250, before `editEntry`):

```javascript
function addFeedback(params) {
  var user = params.user;
  if (!isValidUser(user)) return { error: 'Unknown user' };

  var hearts = parseInt(params.hearts, 10);
  if (isNaN(hearts) || hearts < 0 || hearts > 5) {
    return { error: 'Hearts must be 0-5' };
  }
  var comment = params.comment || '';
  var target = (user === 'Brian') ? 'Linh' : 'Brian';

  var sheet = ensureSheet('Feedback', FEEDBACK_HEADERS);
  var id = Utilities.getUuid();
  var date = new Date().toISOString();
  sheet.appendRow([id, date, user, target, hearts, comment]);

  var award = awardPointsIfEligible(user, 'feedback', id);
  return {
    success: true, id: id, date: date, target: target,
    points_awarded: award ? award.amount : 0
  };
}

function getFeedback() {
  var sheet = ensureSheet('Feedback', FEEDBACK_HEADERS);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}
```

- [ ] **Step 2: Register Feedback in `EDITABLE_SHEETS`**

Find (around line 9):

```javascript
var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description']
};
```

Replace with:

```javascript
var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description'],
  'Feedback': ['hearts', 'comment']
};
```

Note: only `hearts` and `comment` are editable. `author` / `target` / `date` are immutable per spec.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): add addFeedback and getFeedback endpoints

Feedback sheet auto-created on first read. Target derived server-side
as the other canonical user. Hearts and comment are editable; author
and target are immutable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Backend — `getStats` endpoint

**Files:**
- Modify: `apps-script/Code.gs`

Aggregates Points (sum amount per user) and Feedback (avg hearts per target) into a per-user object. Used to render the stats footer.

- [ ] **Step 1: Add `getStats` to `Code.gs`**

Insert after `getFeedback`:

```javascript
function getStats() {
  var pointsSheet = ensureSheet('Points', POINTS_HEADERS);
  var feedbackSheet = ensureSheet('Feedback', FEEDBACK_HEADERS);

  var stats = {};
  VALID_USERS.forEach(function (u) {
    stats[u] = { points: 0, avg_hearts: 0, count: 0 };
  });

  // Sum points
  var pData = pointsSheet.getDataRange().getValues();
  if (pData.length > 1) {
    var pHeaders = pData[0];
    var uCol = pHeaders.indexOf('user');
    var aCol = pHeaders.indexOf('amount');
    for (var r = 1; r < pData.length; r++) {
      var u = pData[r][uCol];
      var amt = parseInt(pData[r][aCol], 10) || 0;
      if (stats[u]) stats[u].points += amt;
    }
  }

  // Average hearts (by target)
  var fData = feedbackSheet.getDataRange().getValues();
  if (fData.length > 1) {
    var fHeaders = fData[0];
    var tCol = fHeaders.indexOf('target');
    var hCol = fHeaders.indexOf('hearts');
    var totals = {};
    VALID_USERS.forEach(function (u) { totals[u] = { sum: 0, n: 0 }; });
    for (var r = 1; r < fData.length; r++) {
      var t = fData[r][tCol];
      var h = parseInt(fData[r][hCol], 10);
      if (totals[t] && !isNaN(h)) {
        totals[t].sum += h;
        totals[t].n += 1;
      }
    }
    VALID_USERS.forEach(function (u) {
      stats[u].count = totals[u].n;
      stats[u].avg_hearts = totals[u].n
        ? Math.round((totals[u].sum / totals[u].n) * 10) / 10
        : 0;
    });
  }

  return stats;
}
```

- [ ] **Step 2: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): add getStats endpoint

Aggregates Points (sum) and Feedback (avg hearts by target) per user.
Returns {Brian: {points, avg_hearts, count}, Linh: {...}}.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Backend — wire new actions in router

**Files:**
- Modify: `apps-script/Code.gs`

Register `getFeedback` / `getStats` in `doGet` and `addFeedback` in `doPost`.

- [ ] **Step 1: Update `doGet` (around line 17)**

Replace the existing switch with:

```javascript
function doGet(e) {
  var action = e.parameter.action;
  try {
    switch (action) {
      case 'getPosts':      return respond(getPosts());
      case 'getTimeline':   return respond(getTimeline());
      case 'getCountdown':  return respond(getCountdown());
      case 'getChats':      return respond(getChats());
      case 'getFeedback':   return respond(getFeedback());
      case 'getStats':      return respond(getStats());
      default:              return respond({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return respond({ error: err.toString() });
  }
}
```

- [ ] **Step 2: Update `doPost` (around line 32)**

Replace the existing switch with:

```javascript
function doPost(e) {
  var action = e.parameter.action;
  var result;
  try {
    switch (action) {
      case 'addPost':          result = addPost(e.parameter); break;
      case 'addTimeline':      result = addTimeline(e.parameter); break;
      case 'updateCountdown':  result = updateCountdown(e.parameter); break;
      case 'addChat':          result = addChat(e.parameter); break;
      case 'addFeedback':      result = addFeedback(e.parameter); break;
      case 'editEntry':        result = editEntry(e.parameter); break;
      case 'deleteEntry':      result = deleteEntry(e.parameter); break;
      case 'logLogin':         result = logLogin(e.parameter); break;
      default:                 result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  var json = JSON.stringify(result);
  var safe = JSON.stringify(json);
  return HtmlService.createHtmlOutput(
    '<script>try{top.postMessage(' + safe + ',"*")}catch(e){try{parent.postMessage(' + safe + ',"*")}catch(e2){}}</script>'
  );
}
```

- [ ] **Step 3: Save and redeploy the Apps Script**

In the Apps Script editor: Save → Deploy → Manage deployments → New version. Confirm `SCRIPT_URL` unchanged.

- [ ] **Step 4: Smoke check the new endpoints**

In a browser tab, hit:
- `<SCRIPT_URL>?action=getStats` → should return `{"Brian":{"points":...,"avg_hearts":0,"count":0},"Linh":{...}}`. Points may be > 0 if Task 4 awarded any.
- `<SCRIPT_URL>?action=getFeedback` → should return `[]` (no feedback yet).

- [ ] **Step 5: Commit**

```bash
git -C /home/brian/Websites add apps-script/Code.gs
git -C /home/brian/Websites commit -m "feat(apps-script): route addFeedback, getFeedback, getStats actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend — pass canonical `user` on existing writes

**Files:**
- Modify: `app.js`

Add the canonical user (`getCookie(USER_COOKIE)`) to the payloads of `addPost`, `addChat`, and `addTimeline`. Without this, no points are awarded.

- [ ] **Step 1: Update Post submit payload (around line 453)**

In `initPostForm`, find the `payload = { action: 'addPost', ... }` block and add a `user` line. Only `addPost` needs it (editEntry doesn't award points, so its payload stays unchanged).

For the `addPost` branch (around line 453):

```javascript
        payload = {
          action: 'addPost',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          author: author,
          title: $('post-title').value,
          body: $('post-body').value,
          type: $('post-type').value
        };
```

- [ ] **Step 2: Update Timeline submit payload (around line 593)**

For the `addTimeline` branch:

```javascript
      } else {
        payload = {
          action: 'addTimeline',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          date: $('tl-date').value,
          title: $('tl-title').value,
          description: $('tl-desc').value
        };
      }
```

- [ ] **Step 3: Update Chat submit payload**

Find the `addChat` payload in `initChatForm` (search for `action: 'addChat'`):

```javascript
        payload = {
          action: 'addChat',
          user: getCookie(CONFIG.USER_COOKIE) || '',
          author: author,
          chat_text: $('chat-text').value,
          chat_when: $('chat-when').value,
          notes: $('chat-notes').value
        };
```

(Only the `user` line is new. Preserve any other fields the existing payload sends, e.g., `chat_when`, `notes`.)

- [ ] **Step 4: Smoke check**

Reload the live site, post a new test post. Check the Google Sheet → Points tab → a row appears with your canonical user. Try posting again immediately — no new row (cooldown).

- [ ] **Step 5: Commit**

```bash
git -C /home/brian/Websites add app.js
git -C /home/brian/Websites commit -m "feat(app): pass canonical user on post/chat/timeline writes

Required for server-side point awards. Reads from USER_COOKIE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Frontend — Feedback section & modal HTML

**Files:**
- Modify: `index.html`

Add the nav link, the section, and the modal. No new footer yet (Task 12 covers that).

- [ ] **Step 1: Add nav link (around line 33-37)**

Find:

```html
      <nav class="header-nav">
        <a href="#posts-section" class="nav-link active" data-section="posts-section">Posts</a>
        <a href="#timeline-section" class="nav-link" data-section="timeline-section">Timeline</a>
        <a href="#archive-section" class="nav-link" data-section="archive-section">Archive</a>
      </nav>
```

Replace with:

```html
      <nav class="header-nav">
        <a href="#posts-section" class="nav-link active" data-section="posts-section">Posts</a>
        <a href="#timeline-section" class="nav-link" data-section="timeline-section">Timeline</a>
        <a href="#feedback-section" class="nav-link" data-section="feedback-section">Feedback</a>
        <a href="#archive-section" class="nav-link" data-section="archive-section">Archive</a>
      </nav>
```

- [ ] **Step 2: Add the Feedback section**

Insert before the `<!-- Archive -->` block (around line 97):

```html
    <!-- Feedback -->
    <section id="feedback-section" class="section hidden">
      <div class="section-top">
        <h2 class="section-title">Feedback</h2>
        <button id="new-feedback-btn" class="action-btn">+ Rate Your Partner</button>
      </div>
      <div id="feedback-feed"></div>
      <div id="feedback-loading" class="loader">Loading feedback...</div>
      <p id="feedback-empty" class="empty-msg hidden">No ratings yet. Be the first to leave one!</p>
      <p id="feedback-error" class="error-msg hidden"></p>
    </section>
```

- [ ] **Step 3: Add the Feedback modal**

Insert in the modals block, after the Chat modal closing `</div></div>` (around line 254, before the Lightbox div):

```html
  <!-- Feedback Modal -->
  <div id="feedback-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>Rate Your Partner</h3>
        <button class="modal-x" data-close="feedback-modal">&times;</button>
      </div>
      <form id="feedback-form">
        <p id="feedback-target-label" class="form-label" style="margin-bottom: 12px;">Rating: <strong id="feedback-target-name">your partner</strong></p>
        <label class="form-label">Hearts</label>
        <div id="heart-picker" class="heart-picker" data-value="0">
          <button type="button" class="heart-btn" data-h="1">&#9825;</button>
          <button type="button" class="heart-btn" data-h="2">&#9825;</button>
          <button type="button" class="heart-btn" data-h="3">&#9825;</button>
          <button type="button" class="heart-btn" data-h="4">&#9825;</button>
          <button type="button" class="heart-btn" data-h="5">&#9825;</button>
        </div>
        <label class="form-label">Comment <span class="optional">(optional)</span>
          <textarea id="feedback-comment" class="form-input form-textarea" rows="3"></textarea>
        </label>
        <button type="button" class="form-delete hidden" id="feedback-delete-btn">Delete</button>
        <button type="submit" class="form-submit" id="feedback-submit">Send</button>
      </form>
    </div>
  </div>
```

- [ ] **Step 4: Smoke check**

Reload the site. Click "Feedback" in the nav — section appears. Click "+ Rate Your Partner" — modal opens, heart buttons render (will be unstyled and non-functional until later tasks). Close modal with X.

- [ ] **Step 5: Commit**

```bash
git -C /home/brian/Websites add index.html
git -C /home/brian/Websites commit -m "feat(ui): add Feedback section and modal markup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Frontend — Feedback CSS

**Files:**
- Modify: `style.css`

Card styling, heart picker, glow-new animation. The 9 tier classes come in Task 14.

- [ ] **Step 1: Append to `style.css`**

```css
/* ============================================
   Feedback
   ============================================ */
.feedback-card {
  position: relative;
  background: var(--surface, #15151c);
  border: 1px solid var(--border, #2a2a3a);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 12px;
}
.fb-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  opacity: 0.75;
  margin-bottom: 6px;
}
.fb-author { font-weight: 600; }
.fb-hearts {
  font-size: 22px;
  color: #ff7a8c;
  letter-spacing: 2px;
  margin: 4px 0 8px;
}
.fb-comment {
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Heart picker (modal) */
.heart-picker {
  display: flex;
  gap: 8px;
  margin: 6px 0 14px;
}
.heart-btn {
  background: transparent;
  border: 1px solid #2a2a3a;
  color: #5a5a66;
  font-size: 28px;
  width: 52px;
  height: 52px;
  border-radius: 10px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, transform 0.08s;
}
.heart-btn:hover { transform: translateY(-1px); }
.heart-btn.filled {
  color: #ff7a8c;
  border-color: #ff7a8c;
}

/* "New feature" glow on action buttons */
.action-btn.glow-new {
  position: relative;
  animation: glowNew 2.4s ease-in-out infinite;
}
@keyframes glowNew {
  0%, 100% {
    box-shadow:
      0 0 0 0 rgba(255,122,140,0.5),
      0 0 8px rgba(255,179,71,0.3);
  }
  50% {
    box-shadow:
      0 0 0 6px rgba(255,122,140,0),
      0 0 18px rgba(255,179,71,0.6),
      0 0 28px rgba(255,122,140,0.4);
  }
}
```

- [ ] **Step 2: Smoke check**

Reload the site, open the Feedback modal. Hearts now have square outlined buttons; the Rate button is still un-glowing because the JS that adds `glow-new` lands in Task 13.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add style.css
git -C /home/brian/Websites commit -m "style: add feedback cards, heart picker, and glow-new animation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Frontend — Feedback CRUD JS

**Files:**
- Modify: `app.js`

Mirrors the Posts pattern: load, render, create card, init form (with heart picker), open in edit mode, reset. Plus the `type === 'feedback'` branch in the edit delegate.

- [ ] **Step 1: Add the Feedback module before the Modals block**

Insert before `// ============================================\n  // Modals` (around line 938):

```javascript
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
```

- [ ] **Step 2: Extend the edit delegate**

Find `initEditDelegate` (around line 1035) and update its body:

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
      else if (type === 'feedback') openEditFeedback(id);
    });
  }
```

- [ ] **Step 3: Wire `initFeedbackForm` into `init()` and `loadFeedback` into `loadDashboard()`**

Find `function init()` (around line 1050) and add `initFeedbackForm();` between `initChatForm();` and `initLightbox();`:

```javascript
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

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }
```

Find `function loadDashboard()` (around line 1027) and add `loadFeedback();` (loadStats comes in Task 13):

```javascript
  function loadDashboard() {
    logLoginEvent();
    loadCountdown();
    loadPosts();
    loadTimeline();
    loadChats();
    loadFeedback();
  }
```

- [ ] **Step 4: Stub `loadStats`**

Two `loadStats()` calls were added in step 1 (after submit and after delete). Until Task 13 lands the real implementation, stub it at the end of the IIFE so the calls don't throw. Insert just before the `function init()` declaration:

```javascript
  function loadStats() { /* implemented in Task 13 */ }
```

- [ ] **Step 5: Smoke check**

Reload the site. Click "Feedback" → "+ Rate Your Partner". Confirm:
- Modal title shows your partner's name (Linh if logged in as Brian, vice versa).
- Click hearts — they fill left-to-right, click same heart twice clears.
- Submit a 4-heart rating with a comment. Modal closes; new card appears in the feed showing "Brian → Linh", 4 hearts, comment.
- Click pencil on the card → edit modal preloaded with 4 hearts and comment. Change to 2 hearts, save. Card updates.
- Open Google Sheet → Feedback tab → row reflects the latest hearts.
- Click pencil → Delete → confirm. Card disappears, sheet row removed.

- [ ] **Step 6: Commit**

```bash
git -C /home/brian/Websites add app.js
git -C /home/brian/Websites commit -m "feat(feedback): add CRUD, heart picker, and edit-delegate branch

Mirrors the existing Posts pattern. Server-side target derivation,
client-side identity from USER_COOKIE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Frontend — Stats footer markup

**Files:**
- Modify: `index.html`

Replace the existing `<footer>` with the two-avatar stats footer. The Reference link moves underneath the stats cards.

- [ ] **Step 1: Replace the footer block (around line 129-132)**

Find:

```html
    <footer class="footer">
      &copy; 2026 Ren &amp; Aiko &mdash; All chapters are real.
      <br><a href="https://docs.google.com/spreadsheets/d/1pRrK4cXp_wh3GSZIORFvGI_SjwhnX5_9dbJoLGDeHJE/edit?usp=sharing" target="_blank" rel="noopener" class="footer-link">Reference</a>
    </footer>
```

Replace with:

```html
    <footer class="footer">
      <div id="stats-footer" class="stats-footer">
        <div class="stats-card" data-user="Brian">
          <div class="stats-avatar tier-0" id="stats-avatar-brian">
            <img src="assets/ren-avatar.png" alt="Brian's avatar" loading="lazy">
          </div>
          <div class="stats-name">Brian</div>
          <div class="stats-points" id="stats-points-brian">0 pts</div>
          <div class="stats-rating" id="stats-rating-brian">no ratings yet</div>
        </div>
        <div class="stats-card" data-user="Linh">
          <div class="stats-avatar tier-0" id="stats-avatar-linh">
            <img src="assets/aiko-avatar.png" alt="Linh's avatar" loading="lazy">
          </div>
          <div class="stats-name">Linh</div>
          <div class="stats-points" id="stats-points-linh">0 pts</div>
          <div class="stats-rating" id="stats-rating-linh">no ratings yet</div>
        </div>
      </div>
      <div class="footer-tagline">
        &copy; 2026 Ren &amp; Aiko &mdash; All chapters are real.
        <br><a href="https://docs.google.com/spreadsheets/d/1pRrK4cXp_wh3GSZIORFvGI_SjwhnX5_9dbJoLGDeHJE/edit?usp=sharing" target="_blank" rel="noopener" class="footer-link">Reference</a>
      </div>
    </footer>
```

- [ ] **Step 2: Smoke check**

Reload the site. Both avatars appear in the footer (unstyled circles for now), with "0 pts" and "no ratings yet" beneath each.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add index.html
git -C /home/brian/Websites commit -m "feat(ui): replace footer with two-avatar stats display

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Frontend — Stats footer JS, tier mapping, glow timer

**Files:**
- Modify: `app.js`

Replace the `loadStats` stub with the real fetcher + renderer. Add tier mapping and the launch-date glow init.

- [ ] **Step 1: Add config constants**

Find `var CONFIG = {...}` (around line 7) and add two fields:

```javascript
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
    GLOW_DAYS: 14
  };
```

- [ ] **Step 2: Replace the `loadStats` stub with the real implementation**

Delete the `function loadStats() { /* implemented in Task 13 */ }` stub from Task 11. Add this block in the same position (before `function init()`):

```javascript
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
```

- [ ] **Step 3: Wire `loadStats` into `loadDashboard` and `initFeatureGlow` into `init`**

Find `loadDashboard` and add `loadStats();`:

```javascript
  function loadDashboard() {
    logLoginEvent();
    loadCountdown();
    loadPosts();
    loadTimeline();
    loadChats();
    loadFeedback();
    loadStats();
  }
```

Find `init` and add `initFeatureGlow();` after `initEditDelegate();`:

```javascript
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

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }
```

- [ ] **Step 4: Refresh stats after every awarding write**

Stats also need to refresh after Posts/Chats/Timeline submit (so the avatar count ticks up). In `initPostForm`'s `done()` (around line 420), `initTimelineForm`'s `done()` (around line 570), and `initChatForm`'s `done()` (find via search), add a `loadStats();` call after the existing `load…()` line. For example, in the Post form:

```javascript
      function done() {
        closeModal('post-modal');
        resetPostForm();
        btn.disabled = false;
        loadPosts();
        loadStats();
      }
```

Apply the same one-line addition in the Timeline and Chat done() handlers.

- [ ] **Step 5: Smoke check**

Reload the live site. Footer shows "0 pts" and "no ratings yet" for both. Submit a post — your stats card's pts ticks to 5. Submit a feedback — your stats card's pts ticks to 10 *if* you're not on cooldown for `feedback`. Partner's avg_hearts updates on next refresh.

The Rate button glows softly because today is within 14 days of `FEATURE_LAUNCH`. Open DevTools, set `CONFIG.FEATURE_LAUNCH = '2026-04-01T00:00:00Z'` in the console, reload — the glow should be gone (it's been > 14 days).

- [ ] **Step 6: Commit**

```bash
git -C /home/brian/Websites add app.js
git -C /home/brian/Websites commit -m "feat(stats): wire stats footer, tier mapping, and feature-glow timer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Frontend — manga-aura tier border CSS

**Files:**
- Modify: `style.css`

Nine tier classes (`.tier-0` through `.tier-8`) define progressively richer manga-aura halos around the stats avatars. Tier 0 is unadorned; each step layers more rings, glow, and motion. Tier 8 (max) rotates and pulses.

- [ ] **Step 1: Append to `style.css`**

```css
/* ============================================
   Stats footer
   ============================================ */
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 32px 16px 24px;
}
.stats-footer {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  justify-content: center;
  flex-wrap: wrap;
}
.stats-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 140px;
  gap: 6px;
}
.stats-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  background: #1b1b20;
}
.stats-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.stats-name { font-weight: 600; font-size: 15px; }
.stats-points {
  font-size: 13px;
  color: #ffb347;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.stats-rating {
  font-size: 13px;
  opacity: 0.78;
}
.footer-tagline {
  font-size: 12px;
  opacity: 0.7;
  text-align: center;
}

@media (max-width: 520px) {
  .stats-footer { flex-direction: column; gap: 18px; }
}

/* ============================================
   Avatar tiers (manga aura / energy)
   ============================================ */
.tier-0 {
  box-shadow: 0 0 0 2px #1b1b20, 0 0 0 3px #2a2a3a;
}
.tier-1 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #d96b7c,
    0 0 8px rgba(217,107,124,0.35);
}
.tier-2 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #d96b7c,
    0 0 14px rgba(217,107,124,0.5);
}
.tier-3 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #d96b7c,
    0 0 20px rgba(217,107,124,0.65),
    0 0 0 7px rgba(255,179,71,0.5);
}
.tier-4 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #ffb347,
    0 0 0 7px #d96b7c,
    0 0 22px rgba(217,107,124,0.7);
}
.tier-5 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #ffb347,
    0 0 0 7px #d96b7c,
    0 0 26px rgba(255,179,71,0.65),
    0 0 44px rgba(217,107,124,0.4);
  animation: tierBreathe 3.6s ease-in-out infinite;
}
.tier-6 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #ffb347,
    0 0 0 7px #d96b7c,
    0 0 0 10px rgba(255,179,71,0.5),
    0 0 30px rgba(255,179,71,0.7),
    0 0 56px rgba(217,107,124,0.5);
  animation: tierBreathe 3.2s ease-in-out infinite;
}
.tier-7 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #ffb347,
    0 0 0 7px #d96b7c,
    0 0 0 11px #ffb347,
    0 0 36px rgba(255,179,71,0.85),
    0 0 72px rgba(217,107,124,0.55);
  animation: tierBreathe 2.8s ease-in-out infinite;
}
.tier-8 {
  box-shadow:
    0 0 0 2px #1b1b20,
    0 0 0 4px #ffb347,
    0 0 0 8px #d96b7c,
    0 0 0 12px #ffb347,
    0 0 44px rgba(255,179,71,0.95),
    0 0 80px rgba(217,107,124,0.7);
  animation: tierMax 3s linear infinite;
}

@keyframes tierBreathe {
  0%, 100% { filter: brightness(1); }
  50%      { filter: brightness(1.18); }
}
@keyframes tierMax {
  0%   { filter: brightness(1)    hue-rotate(0deg); }
  50%  { filter: brightness(1.22) hue-rotate(20deg); }
  100% { filter: brightness(1)    hue-rotate(0deg); }
}
```

- [ ] **Step 2: Smoke check the tiers**

Reload. Footer avatars are at tier-0 (just a thin double-ring). In DevTools, change one avatar's class manually:

```javascript
document.getElementById('stats-avatar-brian').className = 'stats-avatar tier-4'
```

Watch the border fill in. Try `tier-8` — should rotate hue and breathe.

- [ ] **Step 3: Commit**

```bash
git -C /home/brian/Websites add style.css
git -C /home/brian/Websites commit -m "style: add nine manga-aura tier classes for stats avatars

Tier-0 baseline through tier-8 max. Animation enters at tier-5 and
peaks with hue-rotation at tier-8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: End-to-end manual QA pass

**Files:** none (verification only)

Walk the spec's testing plan against the live site. If any check fails, file a fix as a follow-up commit.

- [ ] **Step 1: Smoke** — log in, post something, watch your stats card's points tick up by 5 (within ~3 seconds of the post submit).

- [ ] **Step 2: Cooldown** — post a second time immediately. Stats card unchanged.

(Optional sanity tweak: in `Code.gs`, set `COOLDOWN_MS = 30 * 1000` temporarily, redeploy, verify a new award after 30s, then revert to `3 * 60 * 60 * 1000` and redeploy.)

- [ ] **Step 3: Rate** — open Feedback, send a 4-heart rating with a comment. Card appears in the feed. Partner's stats card updates `avg_hearts` and `count`.

- [ ] **Step 4: Edit feedback** — click pencil, change to 2 hearts. Card updates. Partner's avg drops.

- [ ] **Step 5: Delete feedback** — click pencil → Delete → confirm. Card removed. If it was the only rating, partner's stats shows "no ratings yet".

- [ ] **Step 6: Tier upgrade** — in DevTools, manually run:

```javascript
document.getElementById('stats-avatar-brian').className = 'stats-avatar tier-7'
```

Confirm the border updates visually.

- [ ] **Step 7: Glow** — confirm `+ Rate Your Partner` button glows softly. In DevTools console: temporarily set `CONFIG.FEATURE_LAUNCH = '2026-03-01T00:00:00Z'` (well past 14 days) and reload — glow should be gone.

- [ ] **Step 8: Cross-device** — log in on a phone (different `USER_COOKIE` instance) after earning points on a laptop. Cooldown is still respected because it's server-side: post immediately on the phone → no points awarded.

- [ ] **Step 9: Self-rating prevention** — verify `Feedback` rows always have `author !== target` by reading the sheet directly. (The server hard-codes `target = the other user`, so this should be impossible to violate.)

- [ ] **Step 10: Mobile layout** — narrow the browser to < 520px. Stats footer stacks vertically; heart picker buttons remain ≥ 44px tall.

- [ ] **Step 11: No commit needed** unless QA finds bugs. If bugs are found, address them and commit fixes individually.
