# Original Countdown Dedicated Page — Design Spec

## Overview

The Archive section on `linhyeh.brianpham.us` currently embeds the entire Original Countdown experience inline — a long block including Before/After toggle, full manga hero, synopsis, characters, preview panels, and the reveal message. This forces users to scroll past it every time they want to reach the newer Saved Chats sub-section.

Extract the Original Countdown into its own dedicated page (`archive/original-countdown.html`), replace the inline block with a compact tile that links to the dedicated page in a new tab, and preserve the original full-bleed experience exactly on its own page.

Auth is shared via the existing `ren-aiko-auth` cookie — no second password prompt.

---

## 1. File Structure

### New files

- `archive/original-countdown.html` — standalone page with the original countdown artifact, Before/After toggle, and reveal message. Loads its own script for auth-gate and toggle wiring.
- `archive/original-countdown.js` — small script: (a) redirect to `/` if `ren-aiko-auth` cookie is not `true`, (b) wire Before/After toggle, (c) no other logic.

### Modified files

- `index.html` — replace the Original Countdown `.archive-entry` block inside `#archive-section` with a compact `<a class="archive-tile">` linking to the dedicated page (new tab).
- `style.css` — add `.archive-tile` styles. The `.orig-*` rules (orig-hero, orig-countdown, orig-synopsis, orig-characters, orig-preview, orig-reveal, etc.) stay as-is — shared by the dedicated page.
- `app.js` — remove `initArchiveToggle` and its call in `init()` (the only `.archive-toggle` on the main page moves to the dedicated page).

### Unchanged

- All `assets/*` images.
- CNAME, .gitignore.
- Everything in the Posts, Timeline, Countdown, and Saved Chats flows.
- The existing `.orig-*` CSS classes.

---

## 2. Dedicated Page (`archive/original-countdown.html`)

### Auth gate

On page load, the inline/linked script reads `document.cookie`:
- If `ren-aiko-auth=true`: proceed, show the page.
- Otherwise: `window.location.replace('/')`.

No visible fallback UI — the redirect is immediate.

### Page chrome

Minimal top bar above the existing `.archive-frame`:

```html
<header class="page-header">
  <a href="/" class="page-back">&larr; Back to dashboard</a>
</header>
```

No site nav, no countdown widget, no posts. The dedicated page is focused solely on the artifact.

### Content

The full content of the current `#archive-section`'s Original Countdown `.archive-entry` — specifically:

- `<h1 class="page-title">The Original Countdown</h1>` — single H1 at the top of the content area, below the back link. Replaces the previous `.archive-heading` (H3) because this is now a standalone page, not a sub-section of a larger dashboard.
- `<p class="page-subtitle">The manga-themed countdown that started it all. &mdash; April 1, 2026</p>` — single paragraph under the H1 with description + date.
- `<div class="archive-toggle">` with Before / After buttons
- `<div id="archive-before" class="archive-view active">` containing `.archive-frame` + the full Before panel (hero, countdown timer with static values, synopsis, characters, preview panels)
- `<div id="archive-after" class="archive-view">` containing `.archive-frame` + the reveal (cover, message, signature)

Image paths in the moved markup are adjusted from `assets/xxx.png` to `../assets/xxx.png` because the file is one directory below the project root.

The Before panel countdown shows the same static values currently in `index.html` ("11 Days 06 Hours 42 Min 18 Sec") — this is a preserved artifact, not a live timer.

### Styles

- `<link rel="stylesheet" href="../style.css">` pulls in the full stylesheet (including the `.orig-*` rules).
- Add a tiny `.page-header` + `.page-back` style (or fold into the shared stylesheet — see Section 4).

### Script

`archive/original-countdown.js` lives alongside the HTML and is loaded with `<script src="original-countdown.js"></script>` at the bottom of `<body>`. Contents:

```js
(function () {
  'use strict';

  // Auth gate — redirect if no password cookie
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

---

## 3. Archive Tile (`index.html`)

Replace the entire existing Original Countdown `.archive-entry` block with:

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

Placement: at the top of `#archive-section` (just under the `<h2 class="section-title">Archive</h2>`), above the `#archive-posts` feed and the Saved Chats sub-section.

---

## 4. Styling (`style.css`)

### New rules

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

### Unchanged

All `.orig-*` rules stay exactly as they are — the dedicated page depends on them.

### Removed

None. Leaving the existing `.archive-toggle`, `.archive-view`, `.archive-frame`, `.archive-entry`, `.archive-heading`, and `.archive-desc` rules — `.archive-entry` is still used by the Saved Chats wrapper, and the others are still used on the dedicated page.

---

## 5. Script Changes (`app.js`)

Remove `initArchiveToggle`:

- Delete the `// Archive Toggle` section (the `initArchiveToggle` function).
- Delete the `initArchiveToggle();` call inside `init()`.

No `.archive-toggle` remains on the main page. The same logic moves (inline) to the dedicated page's script.

---

## 6. Auth Flow

1. User visits `linhyeh.brianpham.us`, enters password → cookie `ren-aiko-auth=true` set (path `/`, SameSite=Lax, 3650-day expiry).
2. User scrolls to Archive, clicks the tile → new tab opens `linhyeh.brianpham.us/archive/original-countdown.html`.
3. Dedicated page's script reads the cookie, finds `ren-aiko-auth=true`, proceeds to render the page.
4. If a user types the URL directly without having visited the site first → cookie absent → redirect to `/` where the password gate greets them.

Because GitHub Pages serves everything from the same origin (`linhyeh.brianpham.us`), the cookie is accessible to the subdirectory page.

---

## 7. Out of scope

- Making other archive entries (Saved Chats, dynamic archive posts) also collapsible or extractable.
- A live-ticking countdown on the dedicated page (it's a preserved artifact — static values stay).
- Deep-linking from the dedicated page into specific sub-panels.
- Breadcrumbs, per-page metadata, or OpenGraph tags for the dedicated page.

---

## 8. Files changed summary

| File | Change |
|---|---|
| `archive/original-countdown.html` | CREATE — dedicated page |
| `archive/original-countdown.js` | CREATE — auth + toggle wiring |
| `index.html` | MODIFY — replace big block with `.archive-tile` |
| `style.css` | MODIFY — add `.archive-tile`, `.page-header`, `.page-back` rules |
| `app.js` | MODIFY — remove `initArchiveToggle` + its call in `init()` |
