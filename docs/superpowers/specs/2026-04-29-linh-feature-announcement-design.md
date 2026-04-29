# Linh Feature Announcement Modal — Design

**Date:** 2026-04-29
**Status:** Approved (pending implementation plan)

## Goal

Make sure Linh learns about the recently shipped **Rate Your Partner** and **Points** features the next time she opens the site, and prompt her to log out and log back in with her password so she experiences the new auth flow (logout buttons in header, stats footer, and tagline).

## Non-goals

- A general-purpose announcement system. This is a single one-shot notice; if a second announcement is needed later, refactor then.
- Any backend / Apps Script changes. The trigger and dismissal state live entirely in the browser.
- Notifying Brian — he already knows about the features.

## Trigger

On dashboard load (after the gate is bypassed or already authed), show the modal if **both** of these are true:

- `ren-aiko-user` cookie is `"Linh"`
- `ren-aiko-seen-rate-points` cookie is **not** set

The seen cookie is set with a 10-year expiry (matching the existing `AUTH_COOKIE` and `USER_COOKIE` convention) the moment the modal is dismissed by any path. This guarantees a one-and-done experience.

Brian is excluded by the user check. Logged-out visitors never reach dashboard load and so never see the modal.

## Modal content

**Title:** `New: Rate your partner + earn points`

**Body:**

> Two new things just landed:
>
> ❤️ **Rate Your Partner** — leave 0–5 hearts (and a comment) on Brian. Find it under **Feedback** in the nav.
>
> ✨ **Points** — every post, chat, milestone, and rating you add earns points. Watch your aura tier glow up in the footer.
>
> One small thing: tap below to log out, then sign back in with your password to start earning.

**Primary button:** `Log out now`

**Close affordances:** standard modal `×` in the header. (No secondary "later" button — the body copy already sets the expectation that logging out is the next step, and the `×` exists for users who want to dismiss without logging out.)

## Behavior

| Action | Effect |
| --- | --- |
| Click **Log out now** | Set seen cookie → clear `AUTH_COOKIE` → `location.reload()`. Skip the `confirm("Log out?")` prompt that the existing `logout()` helper shows, because the modal button is itself an explicit confirmation. Either factor the cookie-clear+reload step into a small `forceLogout()` helper that both the modal and `logout()` call, or inline it in the modal handler — implementer's choice. |
| Click `×` close button | Set seen cookie → hide modal → user remains on dashboard with full access; new Feedback tab and stats glow are still discoverable. |
| Click backdrop / press `Esc` | Same as `×` (only if existing modals already support these — match existing modal behavior, do not introduce new patterns). |

In every dismissal path the seen cookie is written **before** the close action, so even if logout reloads or navigates the page the cookie is already persisted.

## Visual treatment

Reuse the existing `.modal` / `.modal-bg` / `.modal-box` / `.modal-head` markup and styles used by Post, Timeline, Countdown, Chat, and Feedback modals. No new modal chrome.

The body uses two stacked highlight rows — one per feature — with the existing emoji + bold-label pattern. If a small additional CSS rule is needed for spacing between the rows it goes in `style.css`; otherwise no CSS changes.

## Files touched

- `index.html` — add `<div id="announce-modal" class="modal hidden">…</div>` alongside the existing modals (after `feedback-modal`, before `lightbox`).
- `app.js`
  - Add `SEEN_ANNOUNCE_COOKIE: 'ren-aiko-seen-rate-points'` to `CONFIG`.
  - Add `initAnnouncement()` invoked from the dashboard-load code path (the same place that runs after a successful gate or when `isAuthed()` is already true on initial load).
  - Wire `Log out now` handler → write seen cookie → clear `AUTH_COOKIE` and reload (bypassing the `confirm()` prompt in the existing `logout()`).
  - Wire `×` handler → write seen cookie → hide modal.
- `style.css` — only if visual spacing between the two feature rows requires a new rule; otherwise untouched.

No Apps Script changes. No new sheets. No new dependencies.

## Edge cases

- **Linh dismisses with `×` then later clicks a header logout button** — fine; she's already seen the modal, the seen cookie persists, modal will not re-appear after she logs back in.
- **Linh logs out via the modal but cancels at the gate** — seen cookie is set, so even though she's authed-out, the next time she logs in the modal does not show again. This is the intended behavior; the announcement was delivered.
- **Brian logs in on Linh's browser** — the user check (`ren-aiko-user === 'Linh'`) prevents the modal from showing for him.
- **Linh clears her cookies** — she will see the modal again on her next visit. Acceptable; this is consistent with how every other persisted state in the app works.

## Out of scope / will not implement

- Per-feature seen flags or analytics on dismissal.
- A "remind me later" path that defers the seen cookie.
- Any change to the existing logout flow itself — this design only **calls** the existing flow.
