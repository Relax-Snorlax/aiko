# Edit & Delete Entries — Design Spec

## Overview

Let any logged-in user edit or delete Posts, Saved Chats, and Timeline milestones after they've been posted. The site is password-gated with a 2-person audience, so no author-level permission check — if you're in, you can edit anything.

The edit UX reuses the existing "New" modal for each entity type in an "edit mode" (pre-filled, different title/submit/delete buttons). Backend gets two new generic Apps Script endpoints (`editEntry`, `deleteEntry`) that work against any sheet by matching the `id` column.

One schema prerequisite: Timeline rows currently lack an `id` column. The user manually adds one, then a one-shot backfill script assigns UUIDs to existing rows.

---

## 1. Timeline Migration (prerequisite)

Before edit/delete works for Timeline, the sheet needs an `id` column.

### Steps the user performs once

1. In Google Sheet, Timeline tab: insert a new column to the **left of column A**. New layout:

| A | B | C | D |
|---|---|---|---|
| id | date | title | description |

2. In the Apps Script editor, run `backfillTimelineIds()` once from the function picker. It iterates column A and writes `Utilities.getUuid()` into any blank cell. Idempotent — safe to re-run.

### Code that supports the migration

A new `backfillTimelineIds` function in `apps-script/Code.gs`:

```javascript
function backfillTimelineIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var data = sheet.getDataRange().getValues();
  var startRow = (data[0][0] === 'id') ? 1 : 0;  // skip header if present
  for (var r = startRow; r < data.length; r++) {
    if (!data[r][0]) {
      sheet.getRange(r + 1, 1).setValue(Utilities.getUuid());
    }
  }
  return { filled: data.length - startRow };
}
```

### Existing `addTimeline` update

Change the `appendRow` to include a UUID:

```javascript
function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  sheet.appendRow([Utilities.getUuid(), params.date, params.title, params.description || '']);
  return { success: true };
}
```

### Existing `getTimeline` update

The current hand-rolled reader uses a hardcoded 3-column header list (`['date','title','description']`). Update to include `id`:

```javascript
function getTimeline() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  var headers = ['id', 'date', 'title', 'description'];
  var startRow = (data[0][0] === 'id') ? 1 : 0;

  return data.slice(startRow).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : (row[i] || '');
    });
    return obj;
  });
}
```

### SETUP.md update

Change the Timeline tab table to show 4 columns starting with `id`.

---

## 2. Backend — Generic Edit/Delete

New helpers in `apps-script/Code.gs` with two supporting utilities.

### Allowlists

```javascript
var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description']
};
```

Only fields in this allowlist may be updated — `id` and `date`/`saved_date` are never editable through this endpoint.

### `editEntry(params)`

```javascript
function editEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  var allowed = EDITABLE_SHEETS[sheetName];
  if (!allowed) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  // Find the row by id
  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) { rowIndex = r; break; }
  }
  if (rowIndex < 0) return { error: 'Entry not found' };

  // For Posts and Chats image editing: if payload contains base64 images, upload them now.
  // newImageUrls ends up non-null only when a fresh upload happened; it overrides the allowlist write below.
  var newImageUrls = null;
  if (sheetName === 'Posts' && params.image && params.image.length > 0) {
    var mime = params.image_type || 'image/jpeg';
    newImageUrls = uploadImage(params.image, mime, id + '-edit-' + Date.now());
  }
  if (sheetName === 'Chats' && params.images && params.images.length > 0) {
    var images;
    try { images = JSON.parse(params.images); } catch (e) { return { error: 'Invalid images payload' }; }
    var urls = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img || !img.data) continue;
      var mime2 = img.type || 'image/jpeg';
      urls.push(uploadImage(img.data, mime2, id + '-edit-' + Date.now() + '-' + i));
    }
    var kept = params.image_urls ? String(params.image_urls).split(',').filter(Boolean) : [];
    newImageUrls = kept.concat(urls).join(',');
  }

  // Apply allowlist edits (only for fields the client sent).
  allowed.forEach(function (field) {
    if (params[field] === undefined) return;
    var colIndex = headers.indexOf(field);
    if (colIndex < 0) return;
    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(params[field]);
  });

  // Apply computed image URL AFTER the allowlist write, so it always wins when an upload happened.
  if (newImageUrls !== null) {
    var imgField = (sheetName === 'Posts') ? 'image_url' : 'image_urls';
    var imgCol = headers.indexOf(imgField);
    if (imgCol >= 0) sheet.getRange(rowIndex + 1, imgCol + 1).setValue(newImageUrls);
  }

  return { success: true, id: id };
}
```

Note the subtlety for images: the frontend sends either (a) no image payload (nothing changes for images), (b) `image_urls` with the remaining URLs plus `images` JSON for new additions (Chats), or (c) `image_url` empty string (Posts: remove image), or `image` base64 (Posts: replace image).

### `deleteEntry(params)`

```javascript
function deleteEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  if (!EDITABLE_SHEETS[sheetName]) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: 'Entry not found' };
}
```

Note: `deleteEntry` does NOT delete image files in Drive. Orphaned image files in Drive is an accepted cost (YAGNI — personal site, easily pruned manually).

### `doPost` wiring

Add two cases:

```javascript
case 'editEntry':     result = editEntry(e.parameter); break;
case 'deleteEntry':   result = deleteEntry(e.parameter); break;
```

---

## 3. Frontend — Card Edit Affordance

A pencil button in the top-right of each editable card. Uses the existing `.icon-btn` pattern.

### Affected card builders in `app.js`

- `createPostCard(p)` (Posts feed + Archive posts) — add `<button class="edit-btn icon-btn" data-id="${p.id}" data-type="post">&#9998;</button>`
- `createChatCard(c)` — same, with `data-type="chat"`, `data-id="${c.id}"`
- `renderTimeline(entries)` — each `.tl-item` gets the pencil, `data-type="timeline"`, `data-id="${entry.id}"`

### Click delegation

Add a single document-level click delegate in `init` (or in a new `initEdit` function):

```javascript
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.edit-btn');
  if (!btn) return;
  var id = btn.getAttribute('data-id');
  var type = btn.getAttribute('data-type');
  if (type === 'post') openEditPost(id);
  else if (type === 'chat') openEditChat(id);
  else if (type === 'timeline') openEditTimeline(id);
});
```

### Where the pencil is NOT added

- Original Countdown tile (it's a link, not a sheet row)
- `#countdown-section` already has its own edit icon (works through `updateCountdown`, not the generic endpoints)

### Styling

Append to `style.css`:

```css
.post-card, .chat-card, .tl-item { position: relative; }
.edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #7f8c9b;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
}
.edit-btn:hover {
  color: #c782af;
  background: rgba(199, 130, 175, 0.08);
}
```

---

## 4. Frontend — Modal Edit Mode

Each of the three existing modals learns to operate in two modes.

### State

Three module-scoped variables at the top of each init function's scope (or near `pendingImages`):

```javascript
var editingPostId = null;
var editingChatId = null;
var editingTimelineId = null;
```

Additionally for Posts image edit:
```javascript
var postImageRemoved = false;   // true when user clicked "Remove" on existing image
```

Additionally for Chats:
- `pendingImages` (already exists) — newly picked/pasted/dropped files in this session
- `keptImageUrls` (new) — array of existing Drive URLs the user is keeping (starts as the entry's `image_urls` when editing)

### `openEditPost(id)`

1. Find entry in the in-memory array (from the last `loadPosts`). If not found, `alert('Post not found — please refresh.')` and abort.
2. Pre-fill `#post-author`, `#post-title`, `#post-body`, `#post-type`.
3. If `p.image_url`: show a preview row (see Section 5) with a Remove × button.
4. `editingPostId = id`.
5. Modal title → "Edit Post"; submit button → "Save Changes"; show `#post-delete-btn`.
6. `openModal('post-modal')`.

### `openEditChat(id)` and `openEditTimeline(id)`

Analogous. For chats, populate `keptImageUrls` from the existing `image_urls` (split on `,`), render those thumbnails first, then the (empty) `pendingImages` gets appended below.

### Submit handler changes

Each form submit handler checks its editing state var:

```javascript
if (editingPostId) {
  payload = { action: 'editEntry', sheet: 'Posts', id: editingPostId, ... };
} else {
  payload = { action: 'addPost', ... };  // existing flow
}
```

After success in edit mode: reload the list (`loadPosts` / `loadChats` / `loadTimeline`), reset the form, clear `editingXId`.

### Delete button

Add to each modal's form markup (hidden by default):

```html
<button type="button" class="form-delete hidden" id="post-delete-btn">Delete</button>
```

Styled as a secondary/destructive action. Wired:

```javascript
$('post-delete-btn').addEventListener('click', function () {
  if (!editingPostId) return;
  if (!confirm('Delete this post permanently?')) return;
  apiPost({ action: 'deleteEntry', sheet: 'Posts', id: editingPostId })
    .then(function () { closeModal('post-modal'); resetPostForm(); loadPosts(); })
    .catch(function () { alert('Failed to delete. Please try again.'); });
});
```

### Close / reset

Each modal's close path (× button, backdrop click, or successful submit) calls a `resetXForm()` helper that:
- Sets `editingXId = null`
- Restores original modal title and submit text
- Hides delete button
- Clears all form fields, `pendingImages`, `keptImageUrls`, `postImageRemoved`
- Clears any preview image

The existing `initModals` handler already closes modals on `×` and backdrop click — just add a small reset hook so this fires for the three editable modals.

---

## 5. Image Edit UX Details

### Posts (single image)

Form markup change: above the existing `<input type="file" id="post-image">`, insert:

```html
<div id="post-current-image" class="post-current-image hidden">
  <img alt="Current image">
  <button type="button" class="post-remove-img" id="post-remove-img-btn">Remove current image</button>
</div>
```

Behavior:
- When opening for edit and `p.image_url` exists: unhide, set `<img src>`, reset `postImageRemoved = false`.
- Clicking the Remove button: hide the preview, set `postImageRemoved = true`.
- On submit in edit mode:
  - If a new file is picked: send `image` (base64) + `image_type` (mime). `editEntry` uploads it and writes new URL.
  - Else if `postImageRemoved`: send `image_url: ''` explicitly. `editEntry` writes empty.
  - Else: omit `image_url` entirely. `editEntry` preserves the existing value.

### Chats (multi-image)

Existing `#chat-thumbs` container is reused. Edit mode renders two kinds of thumbs:

- **Kept thumbs** — from `keptImageUrls`, use server URL as `<img src>` directly. × button removes from `keptImageUrls` and re-renders.
- **New thumbs** — from `pendingImages`, use `URL.createObjectURL(file)`. Existing × removal logic.

The unified `renderChatThumbs()` concatenates the two. On submit:
- Convert `pendingImages` to base64 → build `images` JSON array (as today).
- Always send `image_urls: keptImageUrls.join(',')` (even if empty).
- `editEntry` uploads new images, concats kept + new, writes the result.

### Timeline

No images. Three text fields only. Nothing special.

---

## 6. File Changes Summary

| File | Change |
|---|---|
| `apps-script/Code.gs` | ADD `backfillTimelineIds`, `editEntry`, `deleteEntry`, `EDITABLE_SHEETS` constant. UPDATE `addTimeline` to include UUID. UPDATE `getTimeline` header list. ADD switch cases in `doPost`. |
| `apps-script/SETUP.md` | UPDATE Timeline tab table (4 columns with `id` first). ADD note about running `backfillTimelineIds` once. |
| `index.html` | ADD delete button + current-image preview block inside `#post-modal` form. ADD delete button inside `#chat-modal` and `#timeline-modal` forms. |
| `style.css` | ADD `.edit-btn`, `.form-delete`, `.post-current-image`, `.post-remove-img` styles. Make `.post-card`, `.chat-card`, `.tl-item` `position: relative`. |
| `app.js` | ADD pencil button in `createPostCard`, `createChatCard`, and timeline item markup. ADD `openEditPost/Chat/Timeline`, `resetPostForm/ChatForm/TimelineForm`, edit-click delegate, delete-click handlers. UPDATE each submit handler with edit-mode branch. UPDATE `renderChatThumbs` to render both kept and pending thumbs. |

---

## 7. Migration / Rollout

1. Merge + push — GitHub Pages rebuilds. Frontend ships with pencil buttons but the Timeline pencil throws server errors until the sheet has an `id` column.
2. User manually adds `id` column to Timeline sheet.
3. User redeploys Apps Script with the new code, then runs `backfillTimelineIds()` once from the editor.
4. Timeline pencil now works for all existing rows.
5. Future `addTimeline` calls automatically include UUIDs.

Posts and Chats work immediately after Apps Script redeploy — they already have `id` columns.

---

## 8. Out of Scope

- Edit history / audit log ("edited by X at Y")
- Undo
- Drive file cleanup on delete (orphaned uploaded images remain in Drive)
- Reordering images in a chat (remove and re-add is the workaround)
- Bulk delete
- Edit on the Countdown (has its own dedicated update endpoint already)
- Edit on the Original Countdown archive tile (hardcoded markup, not sheet-backed)

---

## 9. Error Handling

- Entry not found in client-side array on edit open → `alert('Not found — please refresh.')`
- Server returns `{error: ...}` on edit/delete → `alert('Failed to save/delete. Please try again.')`
- Network timeout → existing `apiPost` fallback resolves success; reload the data to reveal actual state
- Timeline row with no `id` attempted to edit → server returns "Entry not found" → user sees alert prompting refresh (after they've run backfill, issue resolves)
