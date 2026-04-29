# Linh Feature Announcement Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Linh a one-time announcement modal on her next dashboard load that introduces the Rate-Your-Partner and Points features and lets her log out in one click.

**Architecture:** Pure frontend change. New `<div id="announce-modal">` reuses existing `.modal` chrome. A new `initAnnouncement()` in `app.js` wires the close + log-out-now handlers; a new trigger inside `loadDashboard()` decides whether to show the modal based on the `ren-aiko-user` cookie and a new `ren-aiko-seen-rate-points` cookie. The existing `logout()` is refactored slightly so the modal can perform a confirm-less logout via a shared `forceLogout()` helper.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build step, no test harness). Hosted on GitHub Pages from `main`.

---

## Spec reference

Spec: `docs/superpowers/specs/2026-04-29-linh-feature-announcement-design.md`

## File structure

- **Modify** `index.html` — add one new modal block alongside the existing modals.
- **Modify** `app.js` — add one CONFIG entry, one helper (`markAnnouncementSeen`), refactor `logout()` into `logout()` + `forceLogout()`, add `initAnnouncement()` (wires close + log-out-now handlers and shows modal when conditions met), call `initAnnouncement()` from `init()`, call `maybeShowAnnouncement()` from `loadDashboard()`.
- **Do not modify** `style.css` — the existing `.modal` styles are sufficient. The two feature rows are plain `<p>` tags inside `.modal-box` content; no new CSS rule is required.
- **Do not modify** `apps-script/Code.gs` — this is a frontend-only change.

## Codebase conventions to follow

- IIFE wraps everything in `app.js`; new functions go inside the IIFE.
- 2-space indent, single quotes, ES5 (no arrow functions, no `const`/`let`, no template literals — match the existing code).
- `setCookie(name, value, days)` and `getCookie(name)` are the cookie helpers; auth cookies use `3650` days (10 years).
- Modals follow the pattern: `.modal.hidden` → `.modal-bg` (closes on click via `initModals`) → `.modal-box` → `.modal-head` (with `.modal-x[data-close="<id>"]` close button). The `×` is auto-wired by `initModals()` — do not duplicate that wiring.
- The repo has **no automated test framework**. Verification is manual via running the local dev server and exercising flows in the browser. This plan therefore uses a manual verification checklist rather than `pytest`-style tasks.

## Local dev server

The site is plain static files. Serve it from the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. Per project preference (`feedback_remote_access.md`), bind `0.0.0.0` if testing remotely:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

---

## Task 1: Add the announcement-modal HTML

**Files:**
- Modify: `index.html` — insert a new modal block immediately after the closing `</div>` of `#feedback-modal` (around line 318) and before `<!-- Lightbox -->` (around line 320).

- [ ] **Step 1: Insert the modal block**

In `index.html`, after the `feedback-modal` closing `</div>` and before the `<!-- Lightbox -->` comment, add:

```html
  <!-- Announcement Modal (one-time, Linh only) -->
  <div id="announce-modal" class="modal hidden">
    <div class="modal-bg"></div>
    <div class="modal-box">
      <div class="modal-head">
        <h3>New: Rate your partner + earn points</h3>
        <button class="modal-x" data-close="announce-modal">&times;</button>
      </div>
      <div class="announce-body">
        <p>Two new things just landed:</p>
        <p>&#10084;&#65039; <strong>Rate Your Partner</strong> &mdash; leave 0&ndash;5 hearts (and a comment) on Brian. Find it under <strong>Feedback</strong> in the nav.</p>
        <p>&#10024; <strong>Points</strong> &mdash; every post, chat, milestone, and rating you add earns points. Watch your aura tier glow up in the footer.</p>
        <p>One small thing: tap below to log out, then sign back in with your password to start earning.</p>
        <button type="button" class="form-submit" id="announce-logout-btn">Log out now</button>
      </div>
    </div>
  </div>
```

Notes:
- `class="modal hidden"` matches the other modals exactly so it gets the same auto-wiring (`.modal-x[data-close]` and `.modal-bg` click-to-close from `initModals()`).
- The `Log out now` button reuses the existing `.form-submit` class so it inherits the primary-button styling already used by the other modal submit buttons.
- The body uses `<p>` tags (not `<label>` rows) because there is no form here — just informational copy.

- [ ] **Step 2: Verify no JS error and the modal is hidden by default**

Run:

```bash
python3 -m http.server 8000
```

In a browser tab open `http://localhost:8000/`. Confirm:
- Site loads normally.
- Browser devtools console shows no new errors.
- `document.getElementById('announce-modal').classList.contains('hidden')` returns `true` from the console.
- Manually unhide the modal from the console: `document.getElementById('announce-modal').classList.remove('hidden')` — confirm the modal appears with the title, four paragraphs, and a "Log out now" button. Click the `×` and confirm it closes (the existing `initModals()` already handles the `×` click via `data-close="announce-modal"`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add announcement modal markup for rate/points launch"
```

---

## Task 2: Add the seen-cookie helper to `app.js`

**Files:**
- Modify: `app.js` — add a CONFIG entry and a small helper.

- [ ] **Step 1: Add `SEEN_ANNOUNCE_COOKIE` to CONFIG**

In `app.js`, find the `CONFIG` object (starts around line 7). After the `GLOW_DAYS: 14` line and before the closing `};`, add a trailing comma to `GLOW_DAYS: 14` and a new line:

```javascript
    GLOW_DAYS: 14,
    SEEN_ANNOUNCE_COOKIE: 'ren-aiko-seen-rate-points'
```

- [ ] **Step 2: Add `markAnnouncementSeen` helper**

Immediately above the existing `// Auth / Password Gate` section header (around line 57, just before `function isAuthed()`), add:

```javascript
  function markAnnouncementSeen() {
    setCookie(CONFIG.SEEN_ANNOUNCE_COOKIE, '1', 3650);
  }
```

This pairs the helper with the other cookie utilities and uses the same 3650-day expiry as `AUTH_COOKIE`/`USER_COOKIE`.

- [ ] **Step 3: Smoke-check from devtools**

Reload `http://localhost:8000/` and from the console run:

```javascript
document.cookie  // confirm no `ren-aiko-seen-rate-points` cookie yet
```

There is no app-level entry point yet to call `markAnnouncementSeen` — that comes in Task 4. This step just confirms no syntax error broke the file (the gate still loads, no console errors).

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(app): add seen-announcement cookie helper"
```

---

## Task 3: Split `logout()` into `logout()` + `forceLogout()`

**Files:**
- Modify: `app.js` — refactor the existing `logout()` function (around lines 1293-1297).

- [ ] **Step 1: Replace `logout()` with the split version**

In `app.js`, find:

```javascript
  function logout() {
    if (!confirm('Log out?')) return;
    setCookie(CONFIG.AUTH_COOKIE, '', -1);
    location.reload();
  }
```

Replace with:

```javascript
  function forceLogout() {
    setCookie(CONFIG.AUTH_COOKIE, '', -1);
    location.reload();
  }

  function logout() {
    if (!confirm('Log out?')) return;
    forceLogout();
  }
```

This preserves the existing confirm-then-logout behavior for the header/stats/tagline buttons (they still call `logout()` via `initLogoutButtons()`), and exposes a `forceLogout()` that the announcement modal can call without the confirm prompt.

- [ ] **Step 2: Verify existing logout still works**

In the browser at `http://localhost:8000/`:
1. Type `DreamGirl` in the gate, press Enter — dashboard loads.
2. Click the "Log out" link in the header. Confirm a `Log out?` browser confirm dialog appears.
3. Click Cancel. Confirm you stay on the dashboard.
4. Click "Log out" again, click OK. Confirm the page reloads and the gate is shown.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "refactor(auth): extract forceLogout helper from logout"
```

---

## Task 4: Add `initAnnouncement()` and trigger from `loadDashboard()`

**Files:**
- Modify: `app.js` — add two functions and wire them into `init()` and `loadDashboard()`.

- [ ] **Step 1: Add `initAnnouncement()` and `maybeShowAnnouncement()`**

In `app.js`, find the `// Logout` section header (around line 1290). Insert the following block **above** it (i.e., after `revealUserLogout` is defined but before `// Logout`):

```javascript
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
    show($('announce-modal'));
  }
```

Notes:
- `markAnnouncementSeen` is called as a *sibling* listener on the existing `.modal-x` and `.modal-bg` elements. The existing `initModals()` listener still runs and performs the actual hide/close — this listener only persists the seen flag.
- We do **not** call `markAnnouncementSeen` inside `forceLogout()` itself, because `forceLogout()` is also used by the header logout button, which should not affect the announcement-seen state for Brian or for a future user.

- [ ] **Step 2: Wire `initAnnouncement()` into `init()`**

Find `init()` (around line 1329). After the `initLogoutButtons();` line, add:

```javascript
    initAnnouncement();
```

The full block should now read:

```javascript
    initEditDelegate();
    initFeatureGlow();
    initLogoutButtons();
    initAnnouncement();

    if (isAuthed()) {
```

- [ ] **Step 3: Trigger from `loadDashboard()`**

Find `loadDashboard()` (around line 1279). After `loadStats();` add `maybeShowAnnouncement();` so the function reads:

```javascript
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
```

`maybeShowAnnouncement()` runs after the data loads kick off. It does not await them — they are fire-and-forget — and the modal is independent of any data, so there is no race condition.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat(ui): show one-time rate/points announcement to Linh on dashboard load"
```

---

## Task 5: Manual verification checklist

The repo has no automated test framework. Run through these scenarios in a real browser (Chrome/Safari/Firefox — at least one) before declaring done.

- [ ] **Step 1: Linh sees the modal on first load**

1. Open devtools → Application → Cookies → clear all cookies for `localhost:8000`.
2. Reload `http://localhost:8000/`. The gate appears.
3. Type `DreamGirl`, press Enter.
4. Confirm: the dashboard loads AND the announcement modal appears on top.
5. Confirm modal shows the title `New: Rate your partner + earn points`, the four paragraphs, and a primary `Log out now` button.

- [ ] **Step 2: "Log out now" logs Linh out without a confirm prompt**

(Continuing from Step 1, with the modal open.)

1. Click `Log out now`.
2. Confirm: NO `Log out?` browser confirm appears.
3. Confirm: page reloads and the gate is visible.
4. Open devtools → Application → Cookies. Confirm `ren-aiko-auth` is gone (or set to empty), and `ren-aiko-seen-rate-points` exists with value `1`.

- [ ] **Step 3: Modal does NOT re-appear after re-login**

(Continuing from Step 2.)

1. At the gate, type `DreamGirl` and press Enter.
2. Confirm: the dashboard loads and the announcement modal does NOT appear.

- [ ] **Step 4: Brian never sees the modal**

1. Clear all cookies for `localhost:8000` again.
2. Reload, type `DreamBoy`, press Enter.
3. Confirm: dashboard loads, NO announcement modal appears.
4. Confirm devtools shows `ren-aiko-seen-rate-points` was never set.

- [ ] **Step 5: `×` close marks seen but stays on dashboard**

1. Clear cookies again.
2. Type `DreamGirl`, press Enter — modal appears.
3. Click the `×` in the modal header.
4. Confirm: modal disappears, you remain on the dashboard (no logout, no reload).
5. Confirm devtools shows `ren-aiko-seen-rate-points=1`.
6. Reload the page. Confirm the modal does NOT re-appear.

- [ ] **Step 6: Backdrop click marks seen but stays on dashboard**

1. Clear cookies again.
2. Type `DreamGirl`, press Enter — modal appears.
3. Click on the dimmed backdrop area outside the modal box.
4. Confirm: modal disappears, you remain on the dashboard.
5. Confirm devtools shows `ren-aiko-seen-rate-points=1`.

- [ ] **Step 7: Existing logout flows are unaffected**

1. Clear cookies. Log in as `DreamGirl`. Dismiss the modal with `×`.
2. Click the header "Log out" link. Confirm the `Log out?` confirm DOES appear (regression check on `logout()`).
3. Cancel. Confirm you stay logged in.
4. Click "Log out" again, click OK. Confirm reload + gate.
5. Repeat for the tagline "Log out" link and the stats footer "log out" link visible under Linh's avatar.

- [ ] **Step 8: Commit final touch-ups (if any)**

If any issues turned up in Steps 1–7 that required a code change, commit it now with a focused message. Otherwise skip this step.

---

## Self-review notes (already applied)

- Spec coverage: Task 1 covers the modal markup; Task 2 covers the seen cookie; Task 3 covers the confirm-less logout path required by spec's "Log out now" behavior; Task 4 covers the Linh-only trigger; Task 5 covers all dismissal paths and edge cases listed in the spec.
- Type/name consistency: `SEEN_ANNOUNCE_COOKIE`, `markAnnouncementSeen()`, `forceLogout()`, `initAnnouncement()`, `maybeShowAnnouncement()`, and the HTML id `announce-modal` / button id `announce-logout-btn` are used consistently across all tasks.
- No placeholders. Every step shows the exact code or command.
- Style note: matches the existing IIFE / ES5 / 2-space-indent style of `app.js`.
