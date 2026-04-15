# Ren & Aiko Relationship Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the manga countdown site at linhyeh.brianpham.us into a private relationship dashboard with posts, timeline, configurable countdown, and archive sections.

**Architecture:** Static GitHub Pages frontend (vanilla HTML/CSS/JS) talking to a Google Apps Script backend. Reads via `fetch` GET requests. Writes via hidden iframe form POST (bypasses CORS issues with Apps Script redirects). Images uploaded as base64 through the form, stored in Google Drive via Apps Script. All data lives in a single Google Sheet with three tabs.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Apps Script, Google Sheets, Google Drive, GitHub Pages

---

## File Structure

**Create:**
- `apps-script/Code.gs` — Google Apps Script backend (all API endpoints + image upload)
- `apps-script/SETUP.md` — Manual setup instructions for Brian
- `app.js` — All dashboard frontend logic (auth, API, rendering, forms, countdown)

**Rewrite:**
- `index.html` — Password gate + dashboard layout + archive + form modals
- `style.css` — Complete new stylesheet for all dashboard components

**Delete:**
- `countdown.js` — Logic merged into app.js

**Unchanged:**
- `assets/*` (all 9 images preserved), `CNAME`, `.gitignore`

---

## Task 1: Google Apps Script Backend

**Files:**
- Create: `apps-script/Code.gs`
- Create: `apps-script/SETUP.md`

This task writes the server-side code that Brian will deploy manually in Google's Apps Script editor. It handles all reads (GET) and writes (POST with iframe) plus image uploads to Google Drive.

**Key architecture note:** Google Apps Script 302-redirects POST requests, which causes browsers to change the method to GET (per HTTP spec). To work around this, writes use a hidden iframe form submission. The Apps Script `doPost` returns an HTML page with a `postMessage` script to send the result back to the parent window. A timeout fallback ensures the UI isn't stuck if postMessage fails.

- [ ] **Step 1: Create `apps-script/Code.gs`**

```javascript
// ============================================
// Ren & Aiko Dashboard — Apps Script Backend
// Deploy: Extensions > Apps Script from the Google Sheet
// ============================================

// Replace with your Google Drive folder ID for image uploads
var DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// --- Entry Points ---

function doGet(e) {
  var action = e.parameter.action;
  try {
    switch (action) {
      case 'getPosts':      return respond(getPosts());
      case 'getTimeline':   return respond(getTimeline());
      case 'getCountdown':  return respond(getCountdown());
      default:              return respond({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return respond({ error: err.toString() });
  }
}

function doPost(e) {
  var action = e.parameter.action;
  var result;
  try {
    switch (action) {
      case 'addPost':          result = addPost(e.parameter); break;
      case 'addTimeline':      result = addTimeline(e.parameter); break;
      case 'updateCountdown':  result = updateCountdown(e.parameter); break;
      default:                 result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  // Return HTML that posts result back to the parent window via postMessage
  var json = JSON.stringify(result);
  var safe = JSON.stringify(json);
  return HtmlService.createHtmlOutput(
    '<script>try{top.postMessage(' + safe + ',"*")}catch(e){try{parent.postMessage(' + safe + ',"*")}catch(e2){}}</script>'
  );
}

// --- Helpers ---

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}

// --- Read Operations ---

function getPosts() {
  return sheetToObjects('Posts');
}

function getTimeline() {
  return sheetToObjects('Timeline');
}

function getCountdown() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Countdown');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { label: '', target_date: '', tbd_message: 'Nothing set yet' };
  var headers = data[0];
  var obj = {};
  headers.forEach(function(h, i) {
    obj[h] = data[1][i] instanceof Date ? data[1][i].toISOString() : data[1][i];
  });
  return obj;
}

// --- Write Operations ---

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
  return { success: true, id: id, date: date, image_url: imageUrl };
}

function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  sheet.appendRow([params.date, params.title, params.description || '']);
  return { success: true };
}

function updateCountdown(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Countdown');
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([params.label, params.target_date || '', params.tbd_message || '']);
  } else {
    sheet.getRange(2, 1).setValue(params.label);
    sheet.getRange(2, 2).setValue(params.target_date || '');
    sheet.getRange(2, 3).setValue(params.tbd_message || '');
  }
  return { success: true };
}

// --- Image Upload ---

function uploadImage(base64Data, mimeType, filename) {
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var decoded = Utilities.base64Decode(base64Data);
  var ext = mimeType.split('/')[1] || 'jpg';
  var blob = Utilities.newBlob(decoded, mimeType, filename + '.' + ext);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}
```

- [ ] **Step 2: Create `apps-script/SETUP.md`**

```markdown
# Google Sheet + Apps Script Setup

## 1. Create a New Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet
2. Name it "Ren & Aiko Dashboard"

## 2. Create Sheet Tabs

Create three tabs with these exact column headers in row 1:

**Tab: Posts**

| A  | B    | C      | D     | E    | F         | G    |
|----|------|--------|-------|------|-----------|------|
| id | date | author | title | body | image_url | type |

**Tab: Timeline**

| A    | B     | C           |
|------|-------|-------------|
| date | title | description |

**Tab: Countdown**

| A     | B           | C           |
|-------|-------------|-------------|
| label | target_date | tbd_message |

Then add an initial countdown row (row 2) in the Countdown tab:

| label                         | target_date          | tbd_message |
|-------------------------------|----------------------|-------------|
| Until we're together again    | 2026-04-23T23:00:00  |             |

## 3. Create a Google Drive Folder

1. Go to https://drive.google.com
2. Create a new folder called "Ren & Aiko Images"
3. Copy the folder ID from the URL — the long string after `/folders/`

## 4. Set Up Apps Script

1. In the Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in `Code.gs`
3. Paste the contents of `apps-script/Code.gs` from this repo
4. Replace `YOUR_FOLDER_ID_HERE` with your Drive folder ID from step 3
5. Save (Ctrl+S)

## 5. Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon, select **Web app**
3. Settings:
   - Description: "Ren & Aiko Dashboard API"
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Authorize the app when prompted (you'll see a permissions dialog)
6. **Copy the Web App URL** — you need this for the frontend

## 6. Configure the Frontend

1. Open `app.js` in the repo
2. Find the line: `SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE'`
3. Replace with the Web App URL from step 5
4. Commit and push to deploy

## Redeploying After Changes

If you edit Code.gs later:
1. Go to **Deploy > Manage deployments**
2. Click the pencil icon on your deployment
3. Set version to **New version**
4. Click **Deploy**
```

- [ ] **Step 3: Verify files exist**

Run: `ls apps-script/`
Expected: `Code.gs  SETUP.md`

- [ ] **Step 4: Commit**

```bash
git add apps-script/Code.gs apps-script/SETUP.md
git commit -m "feat: add Google Apps Script backend and setup guide"
```

---

## Task 2: HTML Structure

**Files:**
- Rewrite: `index.html`

Complete rewrite of index.html with the password gate, dashboard layout, all section containers, three form modals, and the archive section preserving the original countdown site markup.

- [ ] **Step 1: Rewrite `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REN & AIKO — Our Story</title>
  <meta name="theme-color" content="#0a0a0f">
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- ========== PASSWORD GATE ========== -->
  <div id="gate" class="gate">
    <div class="gate-bg" style="background-image: url('assets/cover.png')"></div>
    <div class="gate-card">
      <h1 class="gate-title">REN & AIKO</h1>
      <p class="gate-welcome">Welcome to Ren & Aiko's private site</p>
      <p class="gate-prompt">Please enter the password to enter</p>
      <div class="gate-form">
        <input type="password" id="gate-input" class="gate-input" placeholder="Password" autocomplete="off">
        <button id="gate-btn" class="gate-btn">Enter</button>
      </div>
      <p id="gate-error" class="gate-error"></p>
    </div>
  </div>

  <!-- ========== DASHBOARD ========== -->
  <main id="dashboard" class="dashboard hidden">

    <!-- Header -->
    <header class="header">
      <a href="#" class="header-logo">REN & AIKO</a>
      <nav class="header-nav">
        <a href="#countdown-section">Countdown</a>
        <a href="#posts-section">Posts</a>
        <a href="#timeline-section">Timeline</a>
        <a href="#archive-section">Archive</a>
      </nav>
      <button id="nav-toggle" class="nav-toggle">&#9776;</button>
    </header>

    <!-- Countdown -->
    <section id="countdown-section" class="section">
      <div class="section-top">
        <h2 class="section-title">Countdown</h2>
        <button id="countdown-edit" class="icon-btn" title="Edit countdown">&#9998;</button>
      </div>
      <div id="countdown-content" class="hidden">
        <p id="cd-label" class="cd-label"></p>
        <div id="cd-timer" class="cd-timer">
          <div class="cd-unit">
            <span id="cd-days" class="cd-num">--</span>
            <span class="cd-text">Days</span>
          </div>
          <div class="cd-unit">
            <span id="cd-hours" class="cd-num">--</span>
            <span class="cd-text">Hours</span>
          </div>
          <div class="cd-unit">
            <span id="cd-mins" class="cd-num">--</span>
            <span class="cd-text">Min</span>
          </div>
          <div class="cd-unit">
            <span id="cd-secs" class="cd-num">--</span>
            <span class="cd-text">Sec</span>
          </div>
        </div>
        <p id="cd-tbd" class="cd-tbd hidden"></p>
        <p id="cd-reached" class="cd-reached hidden"></p>
      </div>
      <div id="countdown-loading" class="loader">Loading...</div>
    </section>

    <!-- Posts -->
    <section id="posts-section" class="section">
      <div class="section-top">
        <h2 class="section-title">Posts</h2>
        <button id="new-post-btn" class="action-btn">+ New Post</button>
      </div>
      <div id="posts-feed"></div>
      <div id="posts-loading" class="loader">Loading posts...</div>
      <p id="posts-empty" class="empty-msg hidden">No posts yet. Be the first to write something!</p>
      <p id="posts-error" class="error-msg hidden"></p>
    </section>

    <!-- Timeline -->
    <section id="timeline-section" class="section">
      <div class="section-top">
        <h2 class="section-title">Timeline</h2>
        <button id="new-tl-btn" class="action-btn">+ Add Milestone</button>
      </div>
      <div id="timeline-list"></div>
      <div id="timeline-loading" class="loader">Loading timeline...</div>
      <p id="timeline-empty" class="empty-msg hidden">No milestones yet.</p>
      <p id="timeline-error" class="error-msg hidden"></p>
    </section>

    <!-- Archive -->
    <section id="archive-section" class="section">
      <h2 class="section-title">Archive</h2>

      <div class="archive-entry">
        <h3 class="archive-heading">The Original Countdown &mdash; April 1, 2026</h3>
        <p class="archive-desc">The manga-themed countdown that started it all.</p>
        <div class="archive-toggle">
          <button class="toggle-btn active" data-show="archive-before">Before</button>
          <button class="toggle-btn" data-show="archive-after">After</button>
        </div>

        <!-- BEFORE: Countdown site snapshot -->
        <div id="archive-before" class="archive-view active">
          <div class="archive-frame">
            <section class="orig-hero">
              <div class="orig-genre-tags">
                <span class="orig-genre-tag">Romance</span>
                <span class="orig-genre-tag">Slice of Life</span>
              </div>
              <h2 class="orig-title">REN &amp; AIKO</h2>
              <p class="orig-subtitle">A Story of Distance &amp; Devotion</p>
              <div class="orig-badge">VOLUME 1 &mdash; FIRST EDITION</div>
            </section>
            <section class="orig-countdown">
              <p class="orig-cd-label">Official Release Date</p>
              <div class="orig-cd-timer">
                <div class="orig-cd-unit"><span class="orig-cd-num">11</span><span class="orig-cd-text">Days</span></div>
                <div class="orig-cd-unit"><span class="orig-cd-num">06</span><span class="orig-cd-text">Hours</span></div>
                <div class="orig-cd-unit"><span class="orig-cd-num">42</span><span class="orig-cd-text">Min</span></div>
                <div class="orig-cd-unit"><span class="orig-cd-num">18</span><span class="orig-cd-text">Sec</span></div>
              </div>
            </section>
            <section class="orig-synopsis">
              <h3 class="orig-section-header">Synopsis</h3>
              <p class="orig-synopsis-text">Separated by oceans and time zones, Ren counts the days until he can hold Aiko again. Through late-night messages and shared silences, their love stretches across the distance&nbsp;&mdash; bending but never breaking. Now, after years apart, the final chapter is about to begin&hellip;</p>
            </section>
            <section class="orig-characters">
              <h3 class="orig-section-header">Characters</h3>
              <div class="orig-char-card">
                <div class="orig-char-img"><img src="assets/aiko-profile.png" alt="Aiko" loading="lazy"></div>
                <div class="orig-char-info">
                  <h4 class="orig-char-name">AIKO LIN</h4>
                  <p class="orig-char-role">Female Lead</p>
                  <p class="orig-char-desc">Shortest in class, biggest in heart. Her expressions range from soft vulnerability to teasing smugness&nbsp;&mdash; but her smile is what Ren carries with him across every mile.</p>
                </div>
              </div>
              <div class="orig-char-card">
                <div class="orig-char-img"><img src="assets/ren-aiko-portraits.png" alt="Ren" loading="lazy"></div>
                <div class="orig-char-info">
                  <h4 class="orig-char-name">REN</h4>
                  <p class="orig-char-role">Male Lead</p>
                  <p class="orig-char-desc">The one who waits. Patient and steady, Ren holds onto the promise that distance is temporary&nbsp;&mdash; but love is not.</p>
                </div>
              </div>
            </section>
            <section class="orig-preview">
              <h3 class="orig-section-header">Chapter 1 Preview</h3>
              <div class="orig-preview-panel"><img src="assets/preview-panels-1.png" alt="Chapter 1 — page 1" loading="lazy"></div>
              <div class="orig-preview-panel"><img src="assets/preview-panels-2.png" alt="Chapter 1 — page 2" loading="lazy"></div>
              <div class="orig-preview-panel"><img src="assets/preview-collage.png" alt="Chapter 1 — daily life" loading="lazy"></div>
            </section>
            <div class="orig-footer">&copy; 2026 Ren &amp; Aiko &mdash; All chapters are real.</div>
          </div>
        </div>

        <!-- AFTER: Reveal overlay snapshot -->
        <div id="archive-after" class="archive-view">
          <div class="archive-frame">
            <div class="orig-reveal">
              <p class="orig-reveal-badge">NOW AVAILABLE</p>
              <div class="orig-reveal-cover">
                <img src="assets/cover.png" alt="Ren & Aiko — Volume 1 Cover">
              </div>
              <div class="orig-reveal-message">
                <p>I thank God for the many blessings I've received and amongst some of the best blessings like my mom's love and her health, my family's well being and health, business being afloat and my strength and health to continue onwards... is one blessing that I don't think anyone expected and that's the blessing of reconnecting with you because since that moment, life has been fulfilling and I find happiness and joy whenever I'm chatting with you, or thinking about you.</p>
                <br>
                <p>As we continue to grow, I pray that my love for you matures and I pray that our focus on health and happiness only changes for the better. I pray that I never forget that my goal is to make our lives better and if I ever forget, or my actions do not reflect that, that I am reminded so that I can switch gears into actions that align with a healthy life for us.</p>
                <br>
                <p>If you're reading this, that means we're reunited physically... so I won't drag this out so I can let you go back to spending time. Have fun ;)</p>
              </div>
              <p class="orig-reveal-sig">&mdash; Ren</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Archive posts from Google Sheet (type="archive") rendered here by JS -->
      <div id="archive-posts"></div>
    </section>

    <footer class="footer">&copy; 2026 Ren &amp; Aiko &mdash; All chapters are real.</footer>
  </main>

  <!-- ========== MODALS ========== -->

  <!-- New Post Modal -->
  <div id="post-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>New Post</h3>
        <button class="modal-x" data-close="post-modal">&times;</button>
      </div>
      <form id="post-form">
        <label class="form-label">Author
          <input type="text" id="post-author" class="form-input" required>
        </label>
        <label class="form-label">Title <span class="optional">(optional)</span>
          <input type="text" id="post-title" class="form-input">
        </label>
        <label class="form-label">What's on your mind?
          <textarea id="post-body" class="form-input form-textarea" rows="4" required></textarea>
        </label>
        <label class="form-label">Photo <span class="optional">(optional)</span>
          <input type="file" id="post-image" class="form-input" accept="image/*">
        </label>
        <label class="form-label">Type
          <select id="post-type" class="form-input">
            <option value="post">Post</option>
            <option value="archive">Archive (special moment)</option>
          </select>
        </label>
        <button type="submit" class="form-submit" id="post-submit">Post</button>
      </form>
    </div>
  </div>

  <!-- Timeline Modal -->
  <div id="timeline-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>Add Milestone</h3>
        <button class="modal-x" data-close="timeline-modal">&times;</button>
      </div>
      <form id="timeline-form">
        <label class="form-label">Date
          <input type="date" id="tl-date" class="form-input" required>
        </label>
        <label class="form-label">Title
          <input type="text" id="tl-title" class="form-input" required>
        </label>
        <label class="form-label">Description <span class="optional">(optional)</span>
          <textarea id="tl-desc" class="form-input form-textarea" rows="3"></textarea>
        </label>
        <button type="submit" class="form-submit" id="tl-submit">Add Milestone</button>
      </form>
    </div>
  </div>

  <!-- Countdown Settings Modal -->
  <div id="countdown-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>Countdown Settings</h3>
        <button class="modal-x" data-close="countdown-modal">&times;</button>
      </div>
      <form id="countdown-form">
        <label class="form-label">What are we counting down to?
          <input type="text" id="cd-form-label" class="form-input" required>
        </label>
        <label class="form-label">Date &amp; Time <span class="optional">(leave empty for TBD)</span>
          <input type="datetime-local" id="cd-form-date" class="form-input">
        </label>
        <label class="form-label">TBD Message
          <input type="text" id="cd-form-tbd" class="form-input" placeholder="Date coming soon...">
        </label>
        <button type="submit" class="form-submit" id="cd-submit">Update Countdown</button>
      </form>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open in browser to verify structure renders**

Run: `python3 -m http.server 8080 --bind 0.0.0.0 --directory /home/brian/Websites`
Open: `http://100.123.164.42:8080`
Expected: Raw unstyled HTML visible — password gate elements, then dashboard sections. No errors in console.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: rewrite index.html with dashboard structure and archive"
```

---

## Task 3: Stylesheet

**Files:**
- Rewrite: `style.css`

Complete stylesheet covering: password gate, dashboard layout, header/nav, countdown, posts, timeline, archive (including original site snapshot styles), modals/forms, loading/error states, responsive breakpoints.

- [ ] **Step 1: Rewrite `style.css`**

```css
/* ===========================
   REN & AIKO — Private Dashboard
   Dark theme, rose/mauve accents
   =========================== */

/* --- Reset --- */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0a0a0f;
  color: #e8e4df;
  font-family: 'Segoe UI', system-ui, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; display: block; }
.hidden { display: none !important; }

/* --- Password Gate --- */
.gate {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gate-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(8px) brightness(0.3);
}
.gate-card {
  position: relative;
  background: rgba(10, 10, 15, 0.9);
  border: 1px solid #2a1f3d;
  border-radius: 16px;
  padding: 48px 32px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  backdrop-filter: blur(20px);
}
.gate-title {
  font-size: 32px;
  font-weight: 300;
  letter-spacing: 6px;
  background: linear-gradient(135deg, #f5e6d3, #c782af);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 12px;
}
.gate-welcome {
  font-size: 14px;
  color: #b8b0a8;
  margin-bottom: 4px;
}
.gate-prompt {
  font-size: 12px;
  color: #7f8c9b;
  margin-bottom: 24px;
}
.gate-form { display: flex; gap: 8px; }
.gate-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #2a1f3d;
  border-radius: 8px;
  padding: 10px 14px;
  color: #e8e4df;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}
.gate-input:focus { border-color: #c782af; }
.gate-btn {
  background: #c782af;
  color: #0a0a0f;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.gate-btn:hover { opacity: 0.85; }
.gate-error {
  color: #e85d75;
  font-size: 12px;
  margin-top: 12px;
  min-height: 18px;
}
.gate.shake { animation: shake 0.4s ease-in-out; }

/* --- Dashboard Container --- */
.dashboard {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* --- Header --- */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 10, 15, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #1a1a2e;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-logo {
  font-size: 18px;
  font-weight: 300;
  letter-spacing: 4px;
  text-decoration: none;
  background: linear-gradient(135deg, #f5e6d3, #c782af);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.header-nav { display: flex; gap: 20px; }
.header-nav a {
  color: #7f8c9b;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  transition: color 0.2s;
}
.header-nav a:hover { color: #c782af; }
.nav-toggle {
  display: none;
  background: none;
  border: none;
  color: #7f8c9b;
  font-size: 20px;
  cursor: pointer;
}

/* --- Sections --- */
.section {
  padding: 32px 24px;
  border-bottom: 1px solid #1a1a2e;
}
.section-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.section-title {
  flex: 1;
  font-size: 11px;
  color: #c782af;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(199, 130, 175, 0.3), transparent);
}

/* --- Buttons --- */
.icon-btn {
  background: none;
  border: 1px solid #2a1f3d;
  color: #7f8c9b;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.icon-btn:hover { border-color: #c782af; color: #c782af; }
.action-btn {
  background: rgba(199, 130, 175, 0.1);
  border: 1px solid rgba(199, 130, 175, 0.3);
  color: #c782af;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.action-btn:hover { background: rgba(199, 130, 175, 0.2); }

/* --- Countdown --- */
.cd-label {
  font-size: 13px;
  color: #7f8c9b;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 16px;
}
.cd-timer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
.cd-unit {
  background: rgba(199, 130, 175, 0.08);
  border: 1px solid rgba(199, 130, 175, 0.2);
  border-radius: 10px;
  padding: 14px 8px;
  min-width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cd-num {
  font-size: 34px;
  font-weight: 200;
  color: #f5e6d3;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.cd-text {
  font-size: 9px;
  color: #7f8c9b;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 6px;
}
.cd-tbd {
  text-align: center;
  color: #b8b0a8;
  font-style: italic;
  font-size: 15px;
}
.cd-reached {
  text-align: center;
  color: #c782af;
  font-size: 18px;
  letter-spacing: 2px;
}

/* --- Posts --- */
.post-card {
  background: rgba(26, 16, 40, 0.4);
  border: 1px solid #2a1f3d;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.post-card.archive-post {
  border-color: rgba(199, 130, 175, 0.3);
  background: rgba(26, 16, 40, 0.6);
}
.post-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.post-author {
  color: #c782af;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
}
.post-date {
  color: #7f8c9b;
  font-size: 11px;
}
.post-title {
  font-size: 18px;
  font-weight: 300;
  color: #f5e6d3;
  margin-bottom: 8px;
}
.post-body {
  font-size: 14px;
  color: #b8b0a8;
  line-height: 1.8;
  white-space: pre-wrap;
}
.post-image {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
}

/* --- Timeline --- */
.tl-item {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}
.tl-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
}
.tl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c782af;
  flex-shrink: 0;
}
.tl-line {
  width: 1px;
  flex: 1;
  background: #2a1f3d;
}
.tl-content { padding-bottom: 4px; }
.tl-date {
  font-size: 11px;
  color: #7f8c9b;
  letter-spacing: 1px;
  margin-bottom: 2px;
}
.tl-title {
  font-size: 15px;
  color: #f5e6d3;
  font-weight: 400;
}
.tl-desc {
  font-size: 13px;
  color: #7f8c9b;
  margin-top: 4px;
  line-height: 1.6;
}

/* --- Archive --- */
.archive-entry { margin-bottom: 24px; }
.archive-heading {
  font-size: 16px;
  font-weight: 300;
  color: #f5e6d3;
  margin-bottom: 4px;
}
.archive-desc {
  font-size: 13px;
  color: #7f8c9b;
  margin-bottom: 16px;
}
.archive-toggle {
  display: flex;
  margin-bottom: 16px;
  border: 1px solid #2a1f3d;
  border-radius: 8px;
  overflow: hidden;
  width: fit-content;
}
.toggle-btn {
  background: transparent;
  border: none;
  color: #7f8c9b;
  padding: 8px 20px;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.toggle-btn.active {
  background: rgba(199, 130, 175, 0.15);
  color: #c782af;
}
.archive-view { display: none; }
.archive-view.active { display: block; }
.archive-frame {
  border: 1px solid #2a1f3d;
  border-radius: 12px;
  overflow: hidden;
  background: #0a0a0f;
}

/* --- Archive: Original Countdown Site Snapshot Styles --- */
.orig-hero {
  background: linear-gradient(180deg, #1a1028 0%, #0f0f1a 100%);
  padding: 40px 24px 28px;
  text-align: center;
  border-bottom: 1px solid #2a1f3d;
}
.orig-genre-tags { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
.orig-genre-tag {
  background: rgba(199, 130, 175, 0.15);
  color: #c782af;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.orig-title {
  font-size: 32px;
  font-weight: 300;
  letter-spacing: 6px;
  margin-bottom: 4px;
  background: linear-gradient(135deg, #f5e6d3, #c782af);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.orig-subtitle {
  font-size: 12px;
  color: #7f8c9b;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.orig-badge {
  display: inline-block;
  border: 1px solid #c782af;
  color: #c782af;
  padding: 4px 16px;
  border-radius: 4px;
  font-size: 10px;
  letter-spacing: 2px;
}
.orig-countdown {
  padding: 28px 24px;
  text-align: center;
  background: linear-gradient(180deg, #0f0f1a, #0d1117);
}
.orig-cd-label {
  font-size: 10px;
  color: #7f8c9b;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.orig-cd-timer { display: flex; justify-content: center; gap: 10px; }
.orig-cd-unit {
  background: rgba(199, 130, 175, 0.08);
  border: 1px solid rgba(199, 130, 175, 0.2);
  border-radius: 8px;
  padding: 10px 6px;
  min-width: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.orig-cd-num { font-size: 26px; font-weight: 200; color: #f5e6d3; line-height: 1; }
.orig-cd-text {
  font-size: 8px;
  color: #7f8c9b;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: 4px;
}
.orig-synopsis, .orig-characters, .orig-preview {
  padding: 28px 24px;
  border-top: 1px solid #1a1a2e;
}
.orig-section-header {
  font-size: 10px;
  color: #c782af;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 14px;
  font-weight: 400;
}
.orig-synopsis-text {
  font-size: 13px;
  line-height: 1.8;
  color: #b8b0a8;
  font-style: italic;
}
.orig-char-card {
  background: rgba(26, 16, 40, 0.5);
  border: 1px solid #2a1f3d;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}
.orig-char-img { background: #f5f0eb; overflow: hidden; }
.orig-char-info { padding: 14px; }
.orig-char-name { font-size: 18px; font-weight: 300; letter-spacing: 3px; margin-bottom: 2px; }
.orig-char-role {
  font-size: 10px;
  color: #c782af;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.orig-char-desc { font-size: 12px; color: #7f8c9b; line-height: 1.6; }
.orig-preview-panel { border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
.orig-footer {
  padding: 24px;
  text-align: center;
  border-top: 1px solid #1a1a2e;
  color: #3a3a4a;
  font-size: 10px;
  letter-spacing: 1px;
}

/* Archive: Reveal Snapshot */
.orig-reveal {
  padding: 40px 24px 48px;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
}
.orig-reveal-badge {
  font-size: 11px;
  color: #c782af;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 20px;
}
.orig-reveal-cover {
  border: 2px solid #c782af;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 28px;
  box-shadow: 0 0 40px rgba(199, 130, 175, 0.15);
}
.orig-reveal-message {
  font-size: 14px;
  line-height: 1.8;
  color: #b8b0a8;
  text-align: left;
}
.orig-reveal-sig {
  margin-top: 24px;
  font-size: 13px;
  color: #c782af;
  letter-spacing: 2px;
}

/* --- Modals --- */
.modal {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal.hidden { display: none; }
.modal-bg {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
.modal-box {
  position: relative;
  background: #0f0f1a;
  border: 1px solid #2a1f3d;
  border-radius: 16px;
  padding: 28px;
  max-width: 420px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.modal-head h3 {
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 2px;
  color: #f5e6d3;
}
.modal-x {
  background: none;
  border: none;
  color: #7f8c9b;
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
}
.modal-x:hover { color: #e8e4df; }

/* --- Forms --- */
.form-label {
  display: block;
  font-size: 11px;
  color: #7f8c9b;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.optional { text-transform: none; letter-spacing: 0; font-style: italic; }
.form-input {
  display: block;
  width: 100%;
  margin-top: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #2a1f3d;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e8e4df;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.form-input:focus { border-color: #c782af; }
.form-textarea { resize: vertical; min-height: 80px; }
.form-input[type="file"] { padding: 8px; }
select.form-input { appearance: none; cursor: pointer; }
.form-submit {
  display: block;
  width: 100%;
  background: #c782af;
  color: #0a0a0f;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
.form-submit:hover { opacity: 0.85; }
.form-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* --- Loaders & States --- */
.loader {
  text-align: center;
  color: #7f8c9b;
  font-size: 13px;
  padding: 20px;
  font-style: italic;
}
.empty-msg {
  text-align: center;
  color: #7f8c9b;
  font-size: 13px;
  padding: 20px;
  font-style: italic;
}
.error-msg {
  text-align: center;
  color: #e85d75;
  font-size: 13px;
  padding: 12px;
}

/* --- Footer --- */
.footer {
  padding: 32px 24px;
  text-align: center;
  color: #3a3a4a;
  font-size: 11px;
  letter-spacing: 1px;
}

/* --- Animations --- */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

/* --- Responsive --- */
@media (max-width: 600px) {
  .header-nav { display: none; }
  .header-nav.open {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgba(10, 10, 15, 0.98);
    border-bottom: 1px solid #1a1a2e;
    padding: 16px 24px;
    gap: 12px;
  }
  .nav-toggle { display: block; }
  .cd-num { font-size: 26px; }
  .cd-unit { min-width: 56px; padding: 10px 6px; }
}
```

- [ ] **Step 2: Verify in browser**

Run: `python3 -m http.server 8080 --bind 0.0.0.0 --directory /home/brian/Websites` (if not already running)
Open: `http://100.123.164.42:8080`
Expected: Password gate visible with blurred cover.png backdrop, centered card with title, input, and button. Dark theme renders correctly.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: rewrite stylesheet for dashboard layout and components"
```

---

## Task 4: Frontend Logic

**Files:**
- Create: `app.js`

Complete frontend JavaScript: cookie-based auth, API layer (GET via fetch, POST via hidden iframe), countdown display with three states, posts rendering + form, timeline rendering + form, countdown settings form, archive toggle, mobile nav, and initialization.

- [ ] **Step 1: Create `app.js`**

```javascript
(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  var CONFIG = {
    SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE',
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
    $('nav-toggle').addEventListener('click', function () {
      document.querySelector('.header-nav').classList.toggle('open');
    });
    document.querySelectorAll('.header-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.querySelector('.header-nav').classList.remove('open');
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
```

- [ ] **Step 2: Verify password gate in browser**

Open: `http://100.123.164.42:8080`
Test: Enter wrong password → should see "Incorrect password" with shake. Enter "DreamGirl" → gate fades, dashboard appears. No console errors.

- [ ] **Step 3: Verify dashboard sections render**

After entering password, verify:
- Header with nav links visible
- Countdown section shows "Loading..."
- Posts section shows "Loading posts..." then falls back to error state (expected — no API connected)
- Timeline section shows "Loading timeline..." then falls back
- Archive section with Before/After toggle — clicking toggle switches views
- All three form modals open via their buttons and close via X or backdrop click

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add complete dashboard frontend logic"
```

---

## Task 5: Cleanup and Verification

**Files:**
- Delete: `countdown.js`

- [ ] **Step 1: Delete old countdown.js**

```bash
git rm countdown.js
```

- [ ] **Step 2: Verify no references to countdown.js remain**

Run: `grep -r "countdown.js" /home/brian/Websites/ --include="*.html" --include="*.js"`
Expected: No results (index.html now references app.js instead).

- [ ] **Step 3: Full browser walkthrough**

Open: `http://100.123.164.42:8080`

Check each feature:
1. Password gate blocks access, "DreamGirl" lets you in
2. Cookie persists — refresh page, should skip gate
3. Dashboard layout looks correct: header sticky, sections stacked, dark theme with rose accents
4. Countdown shows loading state (API not connected yet — expected)
5. Posts shows loading state (expected)
6. Timeline shows loading state (expected)
7. Archive Before/After toggle works — Before shows original countdown site, After shows reveal message
8. All three form modals open and close properly
9. Mobile: resize to narrow width — hamburger menu appears, nav links in dropdown
10. No console errors

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove old countdown.js, logic moved to app.js"
```

---

## Manual Step: Google Sheet + Apps Script Setup

> **This step is done by Brian manually, not by the implementing agent.**
> Follow the instructions in `apps-script/SETUP.md` to:
> 1. Create the Google Sheet with three tabs
> 2. Create a Google Drive folder for images
> 3. Set up and deploy the Apps Script
> 4. Update `CONFIG.SCRIPT_URL` in `app.js` with the deployment URL
> 5. Push to GitHub to deploy

---

## Task 6: Connect API and End-to-End Test

> **Blocked by:** Manual step above (Brian must provide the Apps Script URL)

**Files:**
- Modify: `app.js:10` — replace `YOUR_APPS_SCRIPT_URL_HERE` with actual URL

- [ ] **Step 1: Update SCRIPT_URL in app.js**

Replace the placeholder on line 10:
```javascript
    SCRIPT_URL: 'https://script.google.com/macros/s/ACTUAL_DEPLOYMENT_ID/exec',
```

- [ ] **Step 2: End-to-end test — Countdown**

Open: `http://100.123.164.42:8080`, enter password.
Expected: Countdown loads showing "Until we're together again" with timer counting down to April 23.
Test: Click edit icon, change label, submit. Countdown reloads with new label.

- [ ] **Step 3: End-to-end test — Posts**

Click "+ New Post", fill in author "Ren", body "First post!", submit.
Expected: Post appears in feed after a few seconds.
Test: Create another post with a photo attached. Photo should appear in the post card.

- [ ] **Step 4: End-to-end test — Timeline**

Click "+ Add Milestone", enter date, title "Met again", submit.
Expected: Milestone appears in timeline.

- [ ] **Step 5: End-to-end test — Archive**

Verify Before/After toggle still works.
Create a post with type "Archive". Verify it appears in the Archive section, not the Posts feed.

- [ ] **Step 6: Commit and push**

```bash
git add app.js
git commit -m "feat: connect Apps Script API for live data"
git push origin main
```

- [ ] **Step 7: Verify live site**

Open: `https://linhyeh.brianpham.us`
Expected: Password gate appears. Enter password, dashboard loads with live data from Google Sheet.
