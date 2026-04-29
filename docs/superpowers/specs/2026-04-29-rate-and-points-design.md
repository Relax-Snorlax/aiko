# Rate Your Partner + Points & Avatar Tiers — Design Spec

**Date:** 2026-04-29
**Status:** Approved
**Author:** Brian Pham (with assistant collaboration)

## Summary

Add a two-person rating system, a points/cooldown ledger, and an avatar-based stats footer to the Ren & Aiko site. Brian and Linh can give each other a 0–5 heart rating with an optional comment. Everyday actions (Posts, Saved Chats, Milestones, Feedback) earn 5 points each, with an independent 3-hour cooldown per action type. Each user's avatar at the bottom of the site shows their current points and average rating, with a manga-aura border that gets more epic at thresholds 5 / 20 / 50 / 100 / 150 / 250 / 500 / 1000.

## Goals

- Give Brian and Linh a fun, low-pressure way to leave nice notes (with a rating) about each other.
- Reward consistent use of the site without enabling spam (cooldowns).
- Make the stats display feel rewarding to grow into — borders that visibly level up.

## Non-goals

- Push notifications for new ratings.
- History/log of tier upgrades.
- Leaderboards, badges, streaks, or any social features beyond the two-user scoreboard.
- Real authentication beyond the existing two-password gate.
- Retroactive points for actions taken before launch.

## Decisions (clarified during brainstorming)

| # | Question | Decision |
|---|---|---|
| 1 | Stats footer: yours only, or both? | **Both side-by-side.** Each user sees their own + their partner's avatar/stats. |
| 2 | Who rates whom? | **Strict partner-to-partner.** Brian rates Linh, Linh rates Brian. Self-ratings disallowed. |
| 3 | Retroactive points? | **Forward-only.** Both users start at 0 points. Existing entries are not counted. |
| 4 | Avatar art? | **Crop from `assets/ren-aiko-portraits.png`** (1536×1024). Commit as `assets/ren-avatar.png` and `assets/aiko-avatar.png`. |
| 5 | UI placement? | **New top-level "Feedback" section** in nav (Posts / Timeline / Archive / Feedback). |
| 6 | Cooldown enforcement? | **Server-side** via Apps Script + Points ledger. |
| 7 | Glow on Rate button? | **Time-boxed, 14 days** from launch. After expiry, button stays but glow is removed. |
| 8 | Edit/delete on feedback? | **Match existing pattern.** Pencil icon on each card, edit hearts + comment, delete. Edits change the partner's average. |
| 9 | Border tier visual style? | **Manga aura / energy** — rose & gold auras intensifying like a power-up; max tier rotates and pulses. |
| 10 | Points storage architecture? | **Ledger sheet** (`Points` table, append-only, one row per award). Cleaner than per-sheet `points_awarded` columns or a cached Stats row. |

## Architecture

### Data model (Google Sheets)

Two new sheets alongside the existing Posts / Chats / Timeline / Countdown / Log.

**`Feedback`** — one row per rating given. Columns:

| col | type | notes |
|---|---|---|
| `id` | uuid | |
| `date` | ISO timestamp | when the rating was submitted |
| `author` | string | rater's canonical user (`Brian` or `Linh`) |
| `target` | string | rated user — derived server-side as the *other* canonical user |
| `hearts` | int 0–5 | |
| `comment` | string | optional |

**`Points`** — append-only ledger. Columns:

| col | type | notes |
|---|---|---|
| `id` | uuid | |
| `date` | ISO timestamp | |
| `user` | string | who earned the point — canonical (`Brian` / `Linh`) |
| `action_type` | enum string | `post` / `chat` / `timeline` / `feedback` |
| `source_id` | uuid | id of the Posts/Chats/Timeline/Feedback row that triggered the award |
| `amount` | int | always 5 today; column kept for future-proofing without migration |

Both sheets are auto-created with their header row by Apps Script on first read if missing — same pattern as the existing Countdown header check.

### Identity rule

Two distinct identity fields on writes that earn points:

- **Display author** — free-text, what shows on a card. Existing `author` column on Posts/Chats. Stays as-is. Lives only on Posts and Chats, populated from the user-typed form field.
- **Canonical user** — `Brian` or `Linh`, sourced from `USER_COOKIE`, sent on every write as a separate `user` parameter. Server validates it's one of the two valid values; rejects with `error: 'Unknown user'` otherwise.

Points awards always reference the canonical user. The display-name `author` field is never used for points math.

**Note on overloaded column names:** the `Feedback` sheet has an `author` column that stores the *canonical* user (`Brian` / `Linh`), not free-text — this is intentional, because feedback is anchored to identity. So `author` means different things in different sheets:

- Posts.author / Chats.author = display name (freeform)
- Feedback.author = canonical user (validated)

### Backend (Apps Script — `apps-script/Code.gs`)

**Cooldown helper** (single source of truth):

```javascript
function awardPointsIfEligible(user, action_type, source_id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000); // 5s — fail fast if contended
  try {
    // Look up most-recent Points row matching user+action_type.
    // If found AND (now - row.date) < 3 hours: return null (on cooldown).
    // Otherwise: append a new Points row, return {amount: 5, awarded: true}.
  } finally {
    lock.releaseLock();
  }
}
```

The cooldown is per `(user, action_type)` and independent — Brian can post (start cooldown on `post`) and immediately save a chat (start separate cooldown on `chat`), and both award.

**Concurrency note:** Apps Script does not serialize `doPost` invocations by default. The `LockService` script lock above guarantees the lookup-then-append sequence is atomic, so two near-simultaneous posts from the same user can't both pass the "no recent row" check. Lock scope is the entire `awardPointsIfEligible` call.

**Modified existing endpoints** — each gains one extra step after appending its row:

- `addPost` → `awardPointsIfEligible(user, 'post', postId)`
- `addChat` → `awardPointsIfEligible(user, 'chat', chatId)`
- `addTimeline` → `awardPointsIfEligible(user, 'timeline', timelineId)`

Each returns `{success, id, …, points_awarded: 5 | 0}`.

**New endpoints:**

- `addFeedback(params)` — appends a Feedback row with `author = canonical user`, `target = the other canonical user`, hearts 0–5, optional comment. Calls `awardPointsIfEligible(user, 'feedback', feedbackId)`.
- `getFeedback()` — returns all Feedback rows, same shape as `getPosts`.
- `getStats()` — returns:
  ```
  {
    Brian: { points: 145, avg_hearts: 4.3, count: 7 },
    Linh:  { points: 200, avg_hearts: 4.7, count: 9 }
  }
  ```
  `points` = sum of `amount` from Points rows where `user` matches.
  `avg_hearts` = average `hearts` from Feedback rows where `target` matches (rounded to 1 decimal).
  `count` = number of Feedback rows where `target` matches (so UI can show "no ratings yet").

**`editEntry` and `deleteEntry`** support `Feedback` (added to the `EDITABLE_SHEETS` allowlist). Edits and deletes on any sheet do **not** touch the Points ledger. The ledger is immutable; points awarded stay awarded.

### Frontend HTML (`index.html`)

1. **New nav link** — `<a href="#feedback-section" class="nav-link" data-section="feedback-section">Feedback</a>` between Archive and the toggle button.
2. **New `<section id="feedback-section" class="section hidden">`** — heading "Feedback", glowing `+ Rate Your Partner` button, `<div id="feedback-feed">`, plus loader/empty/error elements (same pattern as Posts).
3. **New `#feedback-modal`** — author (auto from canonical user, read-only label), heart picker (5 buttons), comment textarea, hidden delete button, submit button.
4. **New `#stats-footer`** replaces the current `<footer>`. Two `.stats-card` divs side-by-side (Brian + Linh):
   - `.stats-avatar` — anime portrait inside a circle, manga-aura border via `tier-N` class
   - User name
   - "X pts" and "★ Y.Y / 5 (n)" beneath
   The existing copyright/Reference line is moved underneath the stats cards as smaller text.

**Feedback card markup:**

```html
<div class="feedback-card">
  <button class="edit-btn" data-id="…" data-type="feedback">✎</button>
  <div class="fb-meta">
    <span class="fb-author">Brian → Linh</span>
    <span class="fb-date">Apr 29, 2026</span>
  </div>
  <div class="fb-hearts">♥♥♥♥♡</div>
  <div class="fb-comment">…optional comment…</div>
</div>
```

**Heart picker UX:** filled hearts up through hovered/selected index, hollow after. Click sets value; clicking the same one twice drops to 0. Buttons ≥ 44px tall for mobile.

### Frontend logic (`app.js`)

**Config additions:**

```javascript
CONFIG.FEATURE_LAUNCH = '2026-04-29T00:00:00Z';
CONFIG.GLOW_DAYS = 14;
```

**Tier mapping (single source of truth):**

```javascript
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
function tierClassFor(points) { /* find largest min ≤ points */ }
```

**Glow logic:** on init, compute `daysSinceLaunch`. If under 14, add `glow-new` class to the Rate button. CSS animation = soft pulsing rose-and-gold glow that matches the manga-aura border palette.

**Stats footer rendering:**

- On dashboard load → `apiGet('getStats')` → render two avatar cards.
- After any successful write that earns points (post / chat / timeline / feedback) → re-fetch stats. The visible point increment under your avatar is the implicit "you got points" feedback.
- If `getStats` errors or returns 0/0, render avatars with placeholder text ("0 pts", "no ratings yet") rather than failing.

**Feedback CRUD** — mirrors the existing post pattern:

- `loadFeedback()`, `renderFeedback()`, `createFeedbackCard()`, `initFeedbackForm()`, `openEditFeedback()`, `resetFeedbackForm()`.
- Identity: `payload.user = getCookie(USER_COOKIE)` is sent with every write that earns points.
- `addFeedback` derives `target` server-side as the other canonical user — the client doesn't need to send it.
- `initEditDelegate` gets a new `type === 'feedback'` branch.

**Cookie payloads.** All four awarding endpoints (`addPost`, `addChat`, `addTimeline`, `addFeedback`) gain a `user` parameter sent from `getCookie(USER_COOKIE)`. The server uses this to award points and (for feedback) derive the target.

### Frontend styles (`style.css`)

- `.feedback-card`, `.fb-meta`, `.fb-hearts`, `.fb-comment` — clone of `.post-card` styles with heart-specific accent color.
- `.heart-picker` — 5 large heart buttons in the modal.
- `.glow-new` — animated rose-and-gold pulse on action buttons (matches the manga-aura palette).
- `.stats-footer`, `.stats-card`, `.stats-avatar` — two-column flex; collapses to vertical stack under 520px.
- `.tier-0` through `.tier-8` — nine border styles (tier-0 = no border, tiers 1–8 progressively richer), each layering more rings/glow/animation. Tier 8 (max, ≥1000 pts) rotates and pulses, matching the manga-aura visual direction approved during brainstorming.

### Asset prep

Crop two square portraits from `assets/ren-aiko-portraits.png` (1536×1024) and commit:

- `assets/ren-avatar.png` — left half cropped square
- `assets/aiko-avatar.png` — right half cropped square

Reasonable target size: ~512×512 each (downscaled is fine; the avatar circle is ~96px on screen).

## Edge cases

- **Missing `USER_COOKIE`** (very old session): the Rate button is disabled and writes silently skip point awards on the server (`user` is empty → `awardPointsIfEligible` returns null). User re-auths through the password gate to restore the cookie.
- **Unknown `user` value** sent to server: rejected with `error: 'Unknown user'`. Client surfaces a generic error.
- **Race on cooldown**: handled by `LockService.getScriptLock()` inside `awardPointsIfEligible`. The lookup-then-append sequence is atomic; back-to-back invocations cannot both read "no recent row" before either appends.
- **Edit feedback hearts**: partner's `avg_hearts` updates on the next `getStats` fetch. This is expected (per decision 8).
- **Delete feedback**: same — `avg_hearts` recomputes; if it was the only rating, the UI shows "no ratings yet".
- **Delete a post/chat/timeline**: Points row remains. No point claw-back. Side effect: deleting and re-creating doesn't re-award (cooldown still holds against the original timestamp).
- **Glow expiration**: after `FEATURE_LAUNCH + GLOW_DAYS`, the `glow-new` class is no longer applied at init time. Button continues to function normally.

## Testing plan (manual, browser-based)

1. **Smoke** — post something. Stats footer should refetch; your `points` ticks up by 5.
2. **Cooldown** — post a second time within seconds. `points_awarded` returns 0; footer count unchanged. (Optional: temporarily lower the cooldown to 30 seconds in `Code.gs` for verification, then revert.)
3. **Rate** — submit a 4-heart rating with a comment. Partner's `avg_hearts` updates on next stats refresh.
4. **Edit feedback** — change rating to 2 hearts. Partner's avg drops accordingly.
5. **Delete feedback** — partner's avg recomputes; if it was the only rating, footer shows "no ratings yet".
6. **Tier upgrade** — temporarily seed Points rows to cross a threshold; confirm avatar border class advances.
7. **Glow** — confirm Rate button glows on launch day; temporarily move `FEATURE_LAUNCH` back 15 days to verify the glow turns off.
8. **Cross-device** — log in on phone after earning points on laptop; cooldown should be respected (server-side).
9. **Self-rating prevention** — verify the modal/server cannot create a Feedback row where `author == target`.

## Open questions / future work

- Sheet auto-creation: if both clients call `getFeedback` simultaneously and the sheet is missing, both might try to create it. The auto-create path should also use `LockService.getScriptLock()` (same script lock as the points helper) to keep this atomic.
- Toast/animation when points are awarded — out of scope for v1; the ticking avatar count is sufficient feedback.
- Tier name labels (e.g., "Bronze / Silver / …") — out of scope; borders speak for themselves.
- Avatar customization — out of scope.
