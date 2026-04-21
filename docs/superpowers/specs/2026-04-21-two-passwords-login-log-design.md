# Two Passwords + Login Log — Design Spec

## Overview

Replace the single site password with two user-specific passwords (`DreamGirl` → Linh, `DreamBoy` → Brian), capture the logged-in user identity in a cookie, and append a row to a new `Log` sheet tab every time an authenticated user opens the dashboard. Each log row contains server-generated timestamp, user name, IP address, IP-derived city/region/country (via `ipapi.co/json/`), and user agent.

---

## 1. Auth Changes

### Frontend `CONFIG`

In `app.js`, replace:

```javascript
PASSWORD: 'DreamGirl',
```

with:

```javascript
PASSWORDS: {
  'DreamGirl': 'Linh',
  'DreamBoy':  'Brian'
},
```

Also add a new cookie name constant:

```javascript
USER_COOKIE: 'ren-aiko-user'
```

### Password check in `initGate()`

Current:

```javascript
if (input.value === CONFIG.PASSWORD) {
  setCookie(CONFIG.AUTH_COOKIE, 'true', 3650);
  ...
}
```

Change to:

```javascript
var typed = input.value;
if (CONFIG.PASSWORDS.hasOwnProperty(typed)) {
  setCookie(CONFIG.AUTH_COOKIE, 'true', 3650);
  setCookie(CONFIG.USER_COOKIE, CONFIG.PASSWORDS[typed], 3650);
  ...
}
```

The rest of the success path (fade out gate, show dashboard) is unchanged. Failure path (shake + "Incorrect password") is unchanged.

### Author field default

Where we currently pre-fill the post and chat author fields from `AUTHOR_COOKIE`, also fall back to `USER_COOKIE` when `AUTHOR_COOKIE` is empty. In `initPostForm`:

```javascript
$('new-post-btn').addEventListener('click', function () {
  resetPostForm();
  var saved = getCookie(CONFIG.AUTHOR_COOKIE) || getCookie(CONFIG.USER_COOKIE);
  if (saved) $('post-author').value = saved;
  openModal('post-modal');
});
```

Same change in `initChatForm`:

```javascript
$('new-chat-btn').addEventListener('click', function () {
  resetChatForm();
  var saved = getCookie(CONFIG.AUTHOR_COOKIE) || getCookie(CONFIG.USER_COOKIE);
  if (saved) $('chat-author').value = saved;
  openModal('chat-modal');
});
```

Timeline doesn't have an author field — no change there.

### Backward compatibility

Existing sessions already have `ren-aiko-auth=true` from the single-password era but no `ren-aiko-user` cookie. Those users will not be forced to re-authenticate but will show up in logs with an empty `user` field. That's acceptable. If we want to force a re-auth, we'd need to invalidate the existing cookie — out of scope.

---

## 2. Log Sheet

### New tab `Log`

Manually add to the Google Sheet. Row 1 headers, 7 columns:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| timestamp | user | ip | city | region | country | user_agent |

### `SETUP.md` update

Append a section documenting the Log tab under `## 2. Create Sheet Tabs` — change "four" to "five" and add a new **Tab: Log** table block alongside Posts, Timeline, Countdown, and Chats.

---

## 3. Backend — Apps Script

### New `logLogin` function in `apps-script/Code.gs`

```javascript
function logLogin(params) {
  var user = params.user || '';
  if (!user) return { error: 'Missing user' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
  if (!sheet) return { error: 'Log tab not found' };

  sheet.appendRow([
    new Date().toISOString(),
    user,
    params.ip || '',
    params.city || '',
    params.region || '',
    params.country || '',
    params.user_agent || ''
  ]);
  return { success: true };
}
```

Placed near the other write endpoints (after `deleteEntry`).

### Wire into `doPost`

Add case before `default`:

```javascript
case 'logLogin':         result = logLogin(e.parameter); break;
```

---

## 4. Frontend — Log Flow

### When to log

Inside `loadDashboard()`, call a new `logLoginEvent()` function at the very start. `loadDashboard` is called in two places: after the password gate passes (in `initGate` on successful entry) and when the cookie-auth path runs in `init()`. Calling `logLoginEvent` from inside `loadDashboard` covers both.

### `logLoginEvent()` — fire and forget

```javascript
function logLoginEvent() {
  var user = getCookie(CONFIG.USER_COOKIE);
  if (!user) return;  // Pre-two-password sessions have no user cookie; skip.

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
        user_agent: navigator.userAgent || ''
      }).catch(function () { /* swallow */ });
    })
    .catch(function () {
      // If ipapi.co fails, still log with what we have.
      apiPost({
        action: 'logLogin',
        user: user,
        user_agent: navigator.userAgent || ''
      }).catch(function () { /* swallow */ });
    });
}
```

Called once from `loadDashboard`:

```javascript
function loadDashboard() {
  logLoginEvent();
  loadCountdown();
  loadPosts();
  loadTimeline();
  loadChats();
}
```

### Rate

One row per dashboard load. Refreshing the page creates a new row. Closing and re-opening the tab creates a new row. That's the intended behavior (user picked "B").

---

## 5. Privacy Notes

- Every dashboard load sends the viewer's IP to `ipapi.co` (third-party). `ipapi.co` logs this per their ToS. Personal site with 2 known users — acceptable.
- The site already stores passwords in cleartext client-side in `CONFIG.PASSWORDS`. Not a new concern.
- Log rows are only visible to sheet owners. No on-site view is rendered.

---

## 6. Error Handling

- `ipapi.co` down / network failure → log entry still written with just `user` + `user_agent`.
- Apps Script POST fails (e.g., `Log` tab missing) → silent failure; no user-facing alert. Logging must never break the site.
- `logLogin` backend without `Log` tab → returns `{error: 'Log tab not found'}` which frontend ignores.

---

## 7. Out of Scope

- On-site view of the log (user picked B: sheet-only).
- Deduplication across rapid refreshes.
- Distinguishing IP-geolocated "city" from real location (IP geo is typically ISP-gateway-accurate).
- Logging timeouts, errors, or non-auth events.
- Invalidating existing pre-two-password cookies to force re-auth.

---

## 8. File Changes Summary

| File | Change |
|---|---|
| `app.js` | Replace `PASSWORD` with `PASSWORDS` map; add `USER_COOKIE`; update gate check; pre-fill author from user cookie; add `logLoginEvent` + call from `loadDashboard`. |
| `apps-script/Code.gs` | Add `logLogin` function; wire into `doPost`. |
| `apps-script/SETUP.md` | Document new `Log` tab (header row); change "four tabs" → "five tabs". |

---

## 9. Rollout

1. Merge + push. GitHub Pages rebuilds.
2. User manually adds `Log` tab to the Google Sheet with the 7 headers.
3. User redeploys Apps Script.
4. Log in with new password (`DreamBoy` or existing `DreamGirl`) → next dashboard load appends a row.
5. Old sessions (with `ren-aiko-auth=true` but no `ren-aiko-user` cookie) will need to log in again to get the user cookie set. To force this: clear `ren-aiko-auth` cookie in the browser manually, or re-enter the password.
