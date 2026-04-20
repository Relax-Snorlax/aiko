# Saved Chats — Design Spec

## Overview

Add a "Saved Chats" sub-section to the Archive area of `linhyeh.brianpham.us`. Lets Brian and Aiko save conversations worth keeping — either by uploading/pasting screenshots, pasting chat transcripts as text, or both — with author, the date/time the chat took place, and personal notes.

Fits into the existing architecture: static site + Google Apps Script + Google Sheets + Google Drive for images. New `Chats` sheet tab, two new Apps Script endpoints, one new frontend sub-section nested inside Archive.

---

## 1. Data Model

New tab in the existing Google Sheet: `Chats`

| column | type | required | notes |
|---|---|---|---|
| `id` | string (UUID) | yes | generated server-side |
| `saved_date` | ISO datetime | yes | auto, set at submit |
| `author` | string | yes | person saving the chat (auto-filled from `AUTHOR_COOKIE`) |
| `chat_text` | string | conditional | pasted chat transcript |
| `image_urls` | string | conditional | comma-separated Drive URLs |
| `chat_when` | string | no | free text ("Apr 15, 2026 8:30 PM" or "Spring 2025") |
| `notes` | string | no | free text |

**Validation:** at least one of `chat_text` or `image_urls` must be non-empty. Enforced in Apps Script.

---

## 2. Backend — Apps Script

**New endpoints** in `apps-script/Code.gs`:

### `GET ?action=getChats`
Returns array of chat objects from the `Chats` sheet. Uses the existing `sheetToObjects('Chats')` helper. Dates serialize to ISO strings (handled by existing helper).

### `POST action=addChat`
Accepts form params:
- `author` (string, required)
- `chat_text` (string, optional)
- `chat_when` (string, optional)
- `notes` (string, optional)
- `images` (string) — JSON-encoded array of `{data: <base64>, type: <mime>}` objects

Flow:
1. Validate `author` present and (`chat_text` OR `images`) present. Throw on failure.
2. Generate UUID `id` and ISO `saved_date`.
3. If `images` present: `JSON.parse`, iterate, call `uploadImage` per image using `<id>-<index>` as filename, collect URLs, join with `,`.
4. Append row `[id, saved_date, author, chat_text, image_urls, chat_when, notes]`.
5. Return `{success: true, id, saved_date, image_urls}`.

### Wiring
- Add `case 'getChats': return respond(getChats());` to `doGet`.
- Add `case 'addChat': result = addChat(e.parameter); break;` to `doPost`.
- Reuse existing `uploadImage(base64, mimeType, filename)` helper unchanged.

### Sheet setup
Add to `apps-script/SETUP.md`: create `Chats` tab with header row `id | saved_date | author | chat_text | image_urls | chat_when | notes`.

---

## 3. Frontend — HTML

In `index.html`, nest new sub-section **inside** the existing `#archive-section`, between the hardcoded "Original Countdown" archive-entry and the dynamic `#archive-posts` container:

```html
<div class="archive-entry">
  <div class="section-top">
    <h3 class="archive-heading">Saved Chats</h3>
    <button id="new-chat-btn" class="action-btn">+ Save Chat</button>
  </div>
  <div id="chats-list"></div>
  <div id="chats-loading" class="loader">Loading chats...</div>
  <p id="chats-empty" class="empty-msg hidden">No saved chats yet.</p>
  <p id="chats-error" class="error-msg hidden"></p>
</div>
```

**New modal** added after the existing modals:

```html
<div id="chat-modal" class="modal hidden">
  <div class="modal-bg"></div>
  <div class="modal-box">
    <div class="modal-head">
      <h3>Save Chat</h3>
      <button class="modal-x" data-close="chat-modal">&times;</button>
    </div>
    <form id="chat-form">
      <label class="form-label">Author
        <input type="text" id="chat-author" class="form-input" required>
      </label>
      <label class="form-label">When did the chat take place? <span class="optional">(optional)</span>
        <input type="text" id="chat-when" class="form-input"
               placeholder="e.g. Apr 15, 2026 8:30 PM or Spring 2025">
      </label>
      <label class="form-label">Screenshots <span class="optional">(upload, paste, or drop)</span></label>
      <div id="chat-dropzone" class="chat-dropzone" tabindex="0">
        <p class="chat-dropzone-hint">Click to choose · Ctrl/Cmd+V to paste · or drag &amp; drop</p>
        <input type="file" id="chat-images" accept="image/*" multiple hidden>
        <div id="chat-thumbs" class="chat-thumbs"></div>
      </div>
      <label class="form-label">Chat text <span class="optional">(paste transcript)</span>
        <textarea id="chat-text" class="form-input form-textarea" rows="5"></textarea>
      </label>
      <label class="form-label">Notes <span class="optional">(optional)</span>
        <textarea id="chat-notes" class="form-input form-textarea" rows="2"></textarea>
      </label>
      <button type="submit" class="form-submit" id="chat-submit">Save Chat</button>
    </form>
  </div>
</div>
```

**Lightbox** — a single reusable overlay for enlarging any chat screenshot:

```html
<div id="lightbox" class="lightbox hidden">
  <img id="lightbox-img" alt="">
</div>
```

---

## 4. Frontend — Behavior (`app.js`)

### Loading
- `loadDashboard()` gets a new call: `loadChats()`.
- `loadChats()` mirrors `loadPosts()`: `apiGet('getChats')`, sort newest first by `saved_date`, render into `#chats-list` or show empty/error state.

### Rendering
- `renderChats(chats)` builds a card per entry:
  - Top meta: author + "saved <formatted saved_date>"
  - If `chat_when`: italic line "Chat from: <chat_when>"
  - If `image_urls`: split on `,`, render each as a stacked `<img class="chat-img">` (click → open lightbox with that src)
  - If `chat_text`: render as a `<pre class="chat-text">` block (preserves line breaks, monospace)
  - If `notes`: muted italic "Notes: <notes>"
- All user content escaped with existing `escHtml` helper. `image_urls` URLs are escaped too.

### Modal form (`initChatForm`)
Follows the pattern of `initPostForm`:
1. Button `#new-chat-btn` opens `chat-modal`; pre-fill `#chat-author` from `AUTHOR_COOKIE`.
2. On submit:
   - Read all pending files (from file picker, paste, and drop — accumulated in a JS array `pendingImages`).
   - Convert each to base64 via `readFileAsBase64`, build `[{data, type}, ...]`, `JSON.stringify`.
   - Client-side validation: require author + (text OR at least one image). If both empty, show inline error and abort.
   - Save author to `AUTHOR_COOKIE` (reuses existing cookie).
   - `apiPost({action:'addChat', author, chat_text, chat_when, notes, images})`.
   - On success: close modal, reset form, clear `pendingImages` and thumbnails, re-call `loadChats()`.
   - On failure: `alert('Failed to save chat. Please try again.')` (matches existing pattern).

### Image input — three paths, one queue
A module-scoped array `pendingImages = []` holds `File` objects until submit.

- **File picker:** clicking `#chat-dropzone` triggers `#chat-images.click()`; its `change` handler pushes each selected file to `pendingImages` and renders a thumbnail.
- **Paste:** `paste` event listener on the dropzone (and on `document` while modal is open). Iterate `e.clipboardData.items`, for each `kind === 'file'` and `type.startsWith('image/')`, call `item.getAsFile()` and push + thumbnail.
- **Drag & drop:** `dragover` → `preventDefault` + add `.drag-over` class. `drop` → `preventDefault`, iterate `e.dataTransfer.files`, push image files + thumbnails.

**Thumbnail rendering** (`renderThumbs`): clears `#chat-thumbs`, generates a thumbnail `<div>` per file using `URL.createObjectURL(file)`, with a small × remove button that splices the file out of `pendingImages` and re-renders.

### Lightbox
`initLightbox()` — a single click delegate on `#chats-list` for `.chat-img` targets: set `#lightbox-img.src`, show `#lightbox`. Click on `#lightbox` hides it.

### Init wiring
Add to the existing `init()`:
```js
initChatForm();
initLightbox();
```
Add to `loadDashboard()`:
```js
loadChats();
```

---

## 5. Styling (`style.css`)

New classes, using existing color/spacing tokens:
- `.chat-dropzone` — dashed border, padded area, hover/drag-over state
- `.chat-dropzone-hint` — muted text, centered
- `.chat-thumbs` — flex-wrap row of small previews
- `.chat-thumb` — 80x80 image with × remove button (absolute-positioned corner)
- `.chat-img` — full-width responsive image, stacked vertically with small gap, cursor:zoom-in
- `.chat-text` — monospace, small padding, left border accent, preserves whitespace (`white-space: pre-wrap`)
- `.chat-when` — italic, muted
- `.chat-notes` — italic, muted, smaller text
- `.lightbox` — fixed overlay, dark backdrop, centered image scaled to viewport
- Reuses existing `.post-card`, `.action-btn`, `.modal`, `.form-*` styles where possible

---

## 6. Error handling & edge cases

- **No chat content submitted (neither text nor image):** client-side inline form error; server-side validation also throws.
- **Large images / many images:** existing `apiPost` timeout already extends to 30s when images are present. Multi-image uploads may run close to this limit — acceptable for personal use.
- **Apps Script 6 MB POST limit:** base64 is ~33% larger than the binary. A rough budget: ~4 MB total binary across all images per submit. Not enforced in code; documented here as a known limitation. If hit, user sees a failure alert and retries with fewer/smaller screenshots.
- **Sheet tab missing:** if `Chats` tab doesn't exist, `getChats` errors; frontend shows "Could not load chats." Setup doc will call this out.
- **Image load failures in the feed:** broken Drive links render as broken `<img>` tags — same behavior as existing Posts; no special handling.

---

## 7. Out of scope

- Edit/delete of saved chats (matches existing Posts/Timeline — no edit UI)
- Search/filter within chats
- Tagging or categorization beyond `chat_when` and `notes`
- Rich formatting of `chat_text` (rendered as preformatted monospace only)
- Reordering screenshots within an entry after they're queued (use × remove + re-add to reorder)

---

## 8. Files changed

- `index.html` — new sub-section markup inside `#archive-section`, new `#chat-modal`, new `#lightbox`
- `app.js` — `loadChats`, `renderChats`, `initChatForm`, `initLightbox`, `pendingImages` queue, paste/drop/picker handlers
- `style.css` — new classes for dropzone, thumbs, chat-img, chat-text, lightbox
- `apps-script/Code.gs` — `getChats`, `addChat`, new `doGet`/`doPost` cases
- `apps-script/SETUP.md` — add `Chats` tab setup step
