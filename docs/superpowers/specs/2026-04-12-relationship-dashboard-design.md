# Ren & Aiko Private Relationship Dashboard — Design Spec

## Overview

Transform the existing manga countdown site at `linhyeh.brianpham.us` into a private relationship dashboard for Brian (Ren) and Aiko. The site serves as a living document of their relationship — posts, milestones, countdowns, and archived meaningful moments — all managed through on-site forms backed by Google Sheets and Google Apps Script.

## Architecture

**Stack:**
- **Frontend:** Static HTML/CSS/JS on GitHub Pages (repo: `Relax-Snorlax/aiko`)
- **Backend API:** Google Apps Script web app (deployed from the Google Sheet)
- **Database:** Google Sheets (one sheet, three tabs)
- **Image Storage:** Google Drive folder (images shared via direct links)
- **Domain:** `linhyeh.brianpham.us` via GoDaddy CNAME → GitHub Pages

**Why this stack:** Free, simple, no server to maintain. Google Sheets is familiar to Brian (already uses it for timeline tracking). Apps Script bridges the gap between the static site and the sheet so all content management happens through on-site forms.

---

## 1. Password Gate

Full-screen lock page shown on first visit.

**Visual:**
- `cover.png` as background, dimmed and blurred
- Centered card with:
  - "REN & AIKO" title (existing gradient style)
  - "Welcome to Ren & Aiko's private site"
  - Password input field
  - "Enter" button

**Behavior:**
- Correct password ("DreamGirl") → sets `ren-aiko-auth=true` cookie (no expiration) → fades out gate, reveals dashboard
- Wrong password → shake animation, "Incorrect password" message
- Return visits → cookie check, skip gate automatically
- This is a casual privacy gate, not hardened security

---

## 2. Dashboard Layout

Single-page scrolling layout. Dark manga theme (background `#0a0a0f`, rose/mauve accents `#c782af`, warm text `#e8e4df`). Sections top to bottom:

### Header/Nav
- "REN & AIKO" branding top-left
- Navigation links: Countdown, Posts, Timeline, Archive

### Countdown Section
- Prominent position at top of dashboard
- Shows: label text, countdown timer (days/hours/min/sec), or TBD state
- Small edit icon to open the countdown settings form
- Three states:
  - **Active countdown:** Label + ticking timer
  - **TBD:** Label + custom TBD message (no timer)
  - **Reached zero:** Label + "Now!" or similar celebration state

### Posts Feed
- Newest first
- Each post displays: author, date, title (if provided), body text, photo (if provided)
- Supports short posts (a caption) and long posts (paragraphs) equally
- "New Post" button opens the post form modal

### Timeline
- Milestones displayed chronologically
- Each entry: date, title, optional description
- "Add Milestone" button opens the timeline form modal

### Archive
- Sacred/meaningful content section
- **First entry: Original Countdown Site**
  - Framed preview area with a "Before / After" toggle switch
  - **Before:** Snapshot of the manga countdown page (hero, timer frozen at 00:00:00:00, synopsis, characters, chapter preview panels)
  - **After:** The reveal overlay (NOW AVAILABLE badge, cover image, personal message, signature)
  - All original assets and markup preserved, wrapped in toggleable containers
- **Future archive entries:** Added via post form with type set to "archive"
  - Displayed separately from regular posts
  - Visual distinction (subtle border or pinned indicator)

### Footer
- "&copy; 2026 Ren & Aiko — All chapters are real."

---

## 3. Google Sheet Structure

One new Google Sheet, three tabs.

### Tab: Posts

| Column      | Type      | Purpose                                      |
|-------------|-----------|----------------------------------------------|
| `id`        | String    | Auto-generated unique ID                     |
| `date`      | Timestamp | When the post was created                    |
| `author`    | String    | "Ren", "Aiko", or free text                  |
| `title`     | String    | Optional — for longer posts                  |
| `body`      | String    | The post content                             |
| `image_url` | String    | Google Drive URL of uploaded photo, or blank  |
| `type`      | String    | "post" or "archive"                          |

### Tab: Timeline

| Column        | Type   | Purpose                          |
|---------------|--------|----------------------------------|
| `date`        | Date   | When the milestone happened      |
| `title`       | String | Short label (e.g., "First date") |
| `description` | String | Optional longer description      |

### Tab: Countdown

| Column        | Type     | Purpose                                    |
|---------------|----------|--------------------------------------------|
| `label`       | String   | What we're counting down to                |
| `target_date` | Datetime | Target date/time, or blank for TBD         |
| `tbd_message` | String   | Message shown when date is blank           |

Countdown tab always has exactly one row (overwritten on update).

---

## 4. On-Site Forms

Three modal overlays, all styled in the dark manga theme.

### New Post Form
- **Author** — text input (defaults to last used name via cookie)
- **Title** — text input (optional)
- **Body** — textarea (expandable)
- **Photo** — file picker (optional, one image per post)
- **Type** — toggle or dropdown: "Post" (default) or "Archive"
- **Submit** → POST to Apps Script `addPost`

### Countdown Settings Form
- Triggered by edit icon near the countdown
- **Label** — text input
- **Date** — date/time picker (leave empty for TBD)
- **TBD Message** — text input (shown when no date set)
- **Submit** → POST to Apps Script `updateCountdown`

### Timeline Entry Form
- **Date** — date picker
- **Title** — text input
- **Description** — textarea (optional)
- **Submit** → POST to Apps Script `addTimeline`

All forms: close on success with brief confirmation message, show error message on failure.

---

## 5. Google Apps Script API

Single Apps Script web app deployed from the Google Sheet.

### GET Endpoints (via URL parameters)

| Action          | Returns                                  |
|-----------------|------------------------------------------|
| `getPosts`      | All rows from Posts tab as JSON array    |
| `getTimeline`   | All rows from Timeline tab as JSON array |
| `getCountdown`  | Single row from Countdown tab as JSON    |

### POST Endpoints

| Action            | Receives                                          | Does                                                       |
|-------------------|---------------------------------------------------|------------------------------------------------------------|
| `addPost`         | author, title, body, type, image (base64 optional)| Writes row to Posts tab, uploads image to Drive if present  |
| `addTimeline`     | date, title, description                          | Appends row to Timeline tab                                |
| `updateCountdown` | label, target_date, tbd_message                   | Overwrites the single Countdown row                        |

### Image Handling
1. Browser converts selected photo to base64
2. Apps Script receives base64 data in POST body
3. Script creates file in a dedicated Google Drive folder
4. Sets file sharing to "anyone with the link can view"
5. Returns the direct view URL, stored in the Posts sheet

### Security
- Apps Script URL is an obscure long random ID
- Site is behind the password gate
- Sufficient for a private 2-person site

---

## 6. Page Load Flow

1. Page loads → check for `ren-aiko-auth` cookie
2. No cookie → show password gate
3. Correct password → set cookie, fade out gate, reveal dashboard
4. Cookie exists → skip gate, go straight to dashboard
5. Dashboard loads → three parallel fetch calls to Apps Script:
   - `getPosts` → render posts feed (newest first)
   - `getTimeline` → render timeline (chronological)
   - `getCountdown` → set up countdown timer or TBD state
6. While fetching → loading skeletons/spinners in each section
7. Archive section → static markup, no fetch needed (original site baked in with before/after toggle)

### Error Handling
- If Apps Script fetch fails → friendly "Couldn't load [section] right now" message
- Password gate, archive, and static elements work regardless of API availability

---

## 7. Visual Theme

Carried over from existing manga countdown site:
- Background: `#0a0a0f`
- Text: `#e8e4df` (primary), `#b8b0a8` (secondary), `#7f8c9b` (muted)
- Accent: `#c782af` (rose/mauve)
- Cards: `rgba(26, 16, 40, 0.5)` with `#2a1f3d` borders
- Font: `'Segoe UI', system-ui, sans-serif`
- Section headers: uppercase, letter-spaced, with gradient line
- Animations: subtle fade-ins and slide-ups

---

## 8. Files Affected

### Modified
- `index.html` — Complete rewrite: password gate + dashboard layout + archive with original site preserved
- `style.css` — Complete rewrite: new dashboard styles, password gate, forms, archive toggle
- `countdown.js` — Rewrite: fetch countdown config from sheet, handle TBD state

### New
- `app.js` — Main dashboard logic: API calls, form handling, post rendering, timeline rendering, cookie management
- Google Apps Script project (separate, in the Google Sheet)
- New Google Sheet (created manually by Brian)

### Preserved
- All files in `assets/` — used by password gate backdrop and archive section
- `CNAME` — domain stays the same
