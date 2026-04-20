# Original Countdown Dedicated Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Original Countdown block from the Archive section into a standalone page at `archive/original-countdown.html`, replaced in-place by a compact tile that links to the new page in a new tab, sharing auth via the existing cookie.

**Architecture:** Move the existing `.archive-entry` markup verbatim into a new HTML file one directory deeper; adjust image paths; wire a small script that reads the auth cookie and handles the Before/After toggle. Remove the now-dead toggle code from `app.js`. Add a tile linking to the new page.

**Tech Stack:** Vanilla HTML/CSS/JS, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-04-20-original-countdown-dedicated-page-design.md`

---

## File Structure

**Create:**
- `archive/original-countdown.html` — standalone page
- `archive/original-countdown.js` — auth gate + Before/After toggle

**Modify:**
- `index.html` — replace the Original Countdown `.archive-entry` block with a compact `.archive-tile`
- `style.css` — add `.archive-tile`, `.page-header`, `.page-back`, `.page-title`, `.page-subtitle` rules
- `app.js` — remove `initArchiveToggle` and its call in `init()`

**Unchanged:** all assets, existing `.orig-*` CSS rules, all other sections.

---

## Task 1: Create dedicated-page script

**Files:**
- Create: `archive/original-countdown.js`

The script does two things: (1) redirect to `/` if the auth cookie isn't set, (2) wire the Before/After toggle. Ported from `app.js`'s `initArchiveToggle`.

- [ ] **Step 1: Create `archive/original-countdown.js`**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add archive/original-countdown.js
git commit -m "feat(archive): add dedicated-page script with auth gate and toggle"
```

---

## Task 2: Create dedicated-page HTML

**Files:**
- Create: `archive/original-countdown.html`

Stand-alone page. Pulls in `../style.css` and loads `original-countdown.js`. Contains the page chrome (back link, title, subtitle), the Before/After toggle, and the two views (the same markup currently in `index.html` lines 104-181, with image `src` paths prefixed `../`).

- [ ] **Step 1: Create `archive/original-countdown.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Original Countdown &mdash; REN &amp; AIKO</title>
  <meta name="theme-color" content="#0a0a0f">
  <link rel="stylesheet" href="../style.css">
</head>
<body>

  <header class="page-header">
    <a href="/" class="page-back">&larr; Back to dashboard</a>
  </header>

  <h1 class="page-title">The Original Countdown</h1>
  <p class="page-subtitle">The manga-themed countdown that started it all. &mdash; April 1, 2026</p>

  <main class="dashboard">

    <div class="archive-entry">
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
              <div class="orig-char-img"><img src="../assets/aiko-profile.png" alt="Aiko" loading="lazy"></div>
              <div class="orig-char-info">
                <h4 class="orig-char-name">AIKO LIN</h4>
                <p class="orig-char-role">Female Lead</p>
                <p class="orig-char-desc">Shortest in class, biggest in heart. Her expressions range from soft vulnerability to teasing smugness&nbsp;&mdash; but her smile is what Ren carries with him across every mile.</p>
              </div>
            </div>
            <div class="orig-char-card">
              <div class="orig-char-img"><img src="../assets/ren-aiko-portraits.png" alt="Ren" loading="lazy"></div>
              <div class="orig-char-info">
                <h4 class="orig-char-name">REN</h4>
                <p class="orig-char-role">Male Lead</p>
                <p class="orig-char-desc">The one who waits. Patient and steady, Ren holds onto the promise that distance is temporary&nbsp;&mdash; but love is not.</p>
              </div>
            </div>
          </section>
          <section class="orig-preview">
            <h3 class="orig-section-header">Chapter 1 Preview</h3>
            <div class="orig-preview-panel"><img src="../assets/preview-panels-1.png" alt="Chapter 1 — page 1" loading="lazy"></div>
            <div class="orig-preview-panel"><img src="../assets/preview-panels-2.png" alt="Chapter 1 — page 2" loading="lazy"></div>
            <div class="orig-preview-panel"><img src="../assets/preview-collage.png" alt="Chapter 1 — daily life" loading="lazy"></div>
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
              <img src="../assets/cover.png" alt="Ren &amp; Aiko — Volume 1 Cover">
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

  </main>

  <script src="original-countdown.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add archive/original-countdown.html
git commit -m "feat(archive): add Original Countdown dedicated page"
```

---

## Task 3: Replace the in-place block with a tile

**Files:**
- Modify: `index.html`

Find the entire `.archive-entry` block that starts at line 101 with:

```html
      <div class="archive-entry">
        <h3 class="archive-heading">The Original Countdown &mdash; April 1, 2026</h3>
```

...and ends at line 182 with the closing `</div>` just before the `<!-- Archive posts from Google Sheet... -->` comment.

- [ ] **Step 1: Delete that block and replace with the compact tile**

Locate this exact region in `index.html` (currently lines 101-182). Replace the entire block with:

```html
      <a class="archive-tile" href="archive/original-countdown.html" target="_blank" rel="noopener">
        <div class="archive-tile-thumb">
          <img src="assets/cover.png" alt="Original Countdown cover" loading="lazy">
        </div>
        <div class="archive-tile-body">
          <h3 class="archive-tile-title">The Original Countdown</h3>
          <p class="archive-tile-date">April 1, 2026</p>
          <p class="archive-tile-desc">The manga-themed countdown that started it all.</p>
          <span class="archive-tile-cta">View &rarr;</span>
        </div>
      </a>
```

After the replacement, the `#archive-section` should look like:

```html
    <section id="archive-section" class="section hidden">
      <h2 class="section-title">Archive</h2>

      <a class="archive-tile" href="archive/original-countdown.html" target="_blank" rel="noopener">
        ...
      </a>

      <!-- Archive posts from Google Sheet (type="archive") rendered here by JS -->
      <div id="archive-posts"></div>

      <!-- Saved Chats -->
      <div class="archive-entry">
        ...Saved Chats block...
      </div>
    </section>
```

- [ ] **Step 2: Verify in browser**

Open `index.html` locally (or hard-refresh the deployed site). Log in, go to Archive. Confirm the tile appears at the top of Archive (above `#archive-posts` and Saved Chats), with the cover thumbnail, title, date, description, and "View →". Click the tile — it should open `/archive/original-countdown.html` in a new tab. The new tab will be broken until Task 5's CSS is in place (expected).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): replace Original Countdown block with compact tile"
```

---

## Task 4: Remove the dead Archive Toggle code from `app.js`

**Files:**
- Modify: `app.js`

Now that the `.archive-toggle` no longer exists on the main page, `initArchiveToggle` has nothing to bind to. Remove it along with its invocation.

- [ ] **Step 1: Remove `initArchiveToggle` function definition**

Find this section in `app.js` (around line 700, between the Lightbox section and Modals section):

```javascript
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

```

Delete the whole block (from the `// ==========` comment header down to and including the blank line after the closing `}`).

- [ ] **Step 2: Remove the call in `init()`**

Find `init()` (around line 780). Remove the `initArchiveToggle();` line:

Before:

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

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }
```

After:

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

    if (isAuthed()) {
      hide($('gate'));
      show($('dashboard'));
      loadDashboard();
    }
  }
```

- [ ] **Step 3: Verify `app.js` still loads cleanly**

Open browser devtools → Console. Reload the site. No `ReferenceError: initArchiveToggle is not defined` or similar. Main dashboard still works (Posts, Timeline, Countdown, Saved Chats all behave as before).

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "refactor(app): remove dead initArchiveToggle — moved to dedicated page"
```

---

## Task 5: Add CSS for tile and dedicated-page chrome

**Files:**
- Modify: `style.css`

Append the new rules at the end of `style.css`. Existing `.orig-*` rules are unchanged and serve both the main page (prior to this change) and the new dedicated page.

- [ ] **Step 1: Append archive-tile and page-chrome styles**

Append to the end of `style.css`:

```css
/* --- Archive Tile --- */
.archive-tile {
  display: flex;
  gap: 14px;
  align-items: stretch;
  text-decoration: none;
  color: inherit;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #2a1f3d;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 24px;
  transition: border-color 0.2s, background 0.2s;
}
.archive-tile:hover {
  border-color: #c782af;
  background: rgba(199, 130, 175, 0.06);
}
.archive-tile-thumb {
  flex: 0 0 auto;
  width: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1420;
}
.archive-tile-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.archive-tile-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.archive-tile-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 2px 0;
  color: #e8e4df;
}
.archive-tile-date {
  font-size: 12px;
  color: #7f8c9b;
  margin: 0 0 6px 0;
}
.archive-tile-desc {
  font-size: 13px;
  color: #b8b0a8;
  margin: 0 0 6px 0;
}
.archive-tile-cta {
  font-size: 13px;
  color: #c782af;
  font-weight: 600;
  align-self: flex-start;
}

/* --- Dedicated Page Chrome --- */
.page-header {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px;
}
.page-back {
  color: #b8b0a8;
  text-decoration: none;
  font-size: 14px;
}
.page-back:hover {
  color: #c782af;
}
.page-title {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px 4px 20px;
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #f5e6d3, #c782af);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.page-subtitle {
  max-width: 720px;
  margin: 0 auto 20px auto;
  padding: 0 20px;
  color: #7f8c9b;
  font-size: 13px;
}
```

- [ ] **Step 2: Verify in browser**

1. Main page: log in, scroll to Archive. Tile renders with thumb left, title/date/desc/CTA right. Hover highlights the border in rose/mauve.
2. Click the tile → opens `/archive/original-countdown.html` in a new tab. The page now renders with back link, title, subtitle, Before/After toggle, and the full manga artifact. Before/After buttons toggle the content.
3. In an incognito window (no auth cookie): visit `/archive/original-countdown.html` directly → script redirects you to `/` where the password gate is shown.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style: add archive tile and dedicated-page chrome styles"
```

---

## Task 6: End-to-end verification

**Files:** none (manual QA)

- [ ] **Step 1: Fresh session regression check**

1. Open an incognito window → `linhyeh.brianpham.us/` → enter password.
2. Archive section: confirm the compact tile is the only Original Countdown presence. The section should be short — tile, any archive posts, Saved Chats.
3. Click tile → new tab opens, full experience, Before/After works, back link returns to dashboard.
4. Close new tab; original tab still shows the dashboard (including Saved Chats) exactly as before.
5. Create a new Saved Chat in the original tab — still works.
6. Create a new Post → still works. Add a Timeline milestone → still works. Countdown ticks — still works.
7. Resize window to mobile width (~360px). Tile stacks or remains readable (thumb + text). Dedicated page: back link, title, subtitle, and manga content all render without horizontal scroll.

- [ ] **Step 2: Direct-URL auth gate**

In a fresh incognito window, type `linhyeh.brianpham.us/archive/original-countdown.html` into the address bar. Expected: immediate redirect to `/`, password gate appears. After entering password, navigate back to the archive URL in that same window — dedicated page now loads.

- [ ] **Step 3: Commit any fixes from verification**

If any issue was found and fixed, commit. Otherwise, skip.

```bash
git add -A
git commit -m "fix(archive): <short description of fix>"
```

---

## Notes for the implementer

- **Image paths** — the dedicated page is one directory deep (`archive/`), so every `src="assets/xxx.png"` becomes `src="../assets/xxx.png"`. Easy source of bugs; double-check after copying the block over.
- **Auth cookie path** — `ren-aiko-auth` is set with `path=/`, so it's readable from subdirectory pages. No change needed.
- **GitHub Pages case sensitivity** — GitHub Pages serves paths case-sensitively. Use `archive/` (lowercase) consistently.
- **No test harness** — verification is manual browser testing. Same convention as Saved Chats.
- **Removed code stays removed** — do not keep `initArchiveToggle` "just in case." It's dead code on the main page and would drift from the dedicated page's copy.
