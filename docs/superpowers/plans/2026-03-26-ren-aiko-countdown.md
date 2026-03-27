# Ren & Aiko Manga Countdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first static countdown website disguised as a manga publisher release page, counting down to April 1, 2026 at 11PM Pacific, with a cover reveal animation and personal message.

**Architecture:** Single-page static site with separate HTML, CSS, and JS files. No framework, no build step. Images served from a local `assets/` directory. Countdown logic in vanilla JS with CSS keyframe animations for the reveal. localStorage tracks reveal state for return visits.

**Tech Stack:** HTML5, CSS3 (keyframe animations, flexbox, gradients), vanilla JavaScript, no dependencies.

**Spec:** `docs/superpowers/specs/2026-03-26-ren-aiko-countdown-design.md`

---

## File Structure

```
/home/brian/Websites/
├── index.html              # Page structure — all 6 sections + reveal overlay
├── style.css               # All styles — layout, colors, typography, animations
├── countdown.js            # Countdown timer, reveal trigger, localStorage state
├── assets/
│   ├── cover.png           # Snorlax hoodie cuddling (reveal image)
│   ├── aiko-profile.png    # Full body + expressions reference sheet (character card)
│   ├── aiko-expressions.png # Expression close-ups (og:image / detail)
│   ├── aiko-standing.png   # Full body standing line art
│   ├── ren-aiko-portraits.png # Bed portraits (Ren character card)
│   ├── embrace.png         # Close-up embrace (secondary reveal art)
│   ├── preview-panels-1.png # Manga dialogue panels (colored)
│   ├── preview-panels-2.png # Reunion cuddling panels (B&W)
│   └── preview-collage.png  # Daily life couple collage
```

---

### Task 1: Copy and Rename Assets

**Files:**
- Create: `assets/` directory with renamed image files

This task copies the artwork from the NAS and gives them human-readable filenames. Only the images we're actually using — skip duplicates and unrelated files.

- [ ] **Step 1: Create assets directory**

```bash
mkdir -p /home/brian/Websites/assets
```

- [ ] **Step 2: Copy and rename selected images**

```bash
NAS="/mnt/nas3/brian/Brian Pham - Personal/Photo and Memories/Aiko"

# Cover reveal image (Snorlax hoodie cuddling)
cp "$NAS/68D955D4-3FAD-4A96-840E-EE1708EA59C5.PNG" assets/cover.png

# Aiko character profile — full body + expressions sheet
cp "$NAS/3CEF80F3-F3CC-4BE4-92A8-9B47C49A2191.PNG" assets/aiko-profile.png

# Aiko expressions close-up (5 expressions)
cp "$NAS/AD8602A8-4148-44F1-990A-28F2A287DEE0.PNG" assets/aiko-expressions.png

# Aiko full body standing (line art)
cp "$NAS/E81EA405-6623-4C07-A978-0181716D981B.PNG" assets/aiko-standing.png

# Manga dialogue panels (colored — morning routine, "You can rest")
cp "$NAS/32B47022-5040-4AD5-B57C-958CB42C9956.PNG" assets/preview-panels-1.png

# Manga panels — reunion cuddling (B&W)
cp "$NAS/1727DF1D-BAB9-4247-8ED3-6E6D6C5F988B.PNG" assets/preview-panels-2.png

# Couple collage — daily life scenes
cp "$NAS/4D9F539B-AD84-4251-8738-2C89E9340DB9.PNG" assets/preview-collage.png

# Ren & Aiko bed portraits (for Ren character card crop)
cp "$NAS/DCF5F64C-FAB2-48DE-B906-065DD45A079C.PNG" assets/ren-aiko-portraits.png

# Close-up embrace (post-reveal secondary image)
cp "$NAS/07031AAE-47D0-43A6-9CE8-F5F8C8CC0511.PNG" assets/embrace.png
```

- [ ] **Step 3: Verify all files copied**

```bash
ls -la /home/brian/Websites/assets/
```

Expected: 9 PNG files, all non-zero size.

- [ ] **Step 4: Commit**

```bash
git add assets/
git commit -m "feat: add artwork assets from NAS with readable filenames"
```

---

### Task 2: HTML Structure — Hero + Countdown

**Files:**
- Create: `index.html`

Build the core page skeleton with the first two sections: hero and countdown timer. No styling yet beyond basic structure.

- [ ] **Step 1: Create index.html with hero and countdown sections**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REN & AIKO — Coming Soon</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="page" class="pre-reveal">

    <!-- Section 1: Hero -->
    <section class="hero">
      <div class="genre-tags">
        <span class="genre-tag">Romance</span>
        <span class="genre-tag">Slice of Life</span>
      </div>
      <h1 class="manga-title">REN & AIKO</h1>
      <p class="manga-subtitle">A Story of Distance & Devotion</p>
      <div class="volume-badge">VOLUME 1 — FIRST EDITION</div>
    </section>

    <!-- Section 2: Countdown -->
    <section class="countdown-section">
      <p class="countdown-label">Official Release Date</p>
      <div class="countdown-timer" id="countdown">
        <div class="time-unit">
          <span class="time-number" id="days">--</span>
          <span class="time-label">Days</span>
        </div>
        <div class="time-unit">
          <span class="time-number" id="hours">--</span>
          <span class="time-label">Hours</span>
        </div>
        <div class="time-unit">
          <span class="time-number" id="minutes">--</span>
          <span class="time-label">Min</span>
        </div>
        <div class="time-unit">
          <span class="time-number" id="seconds">--</span>
          <span class="time-label">Sec</span>
        </div>
      </div>
    </section>

  </main>

  <script src="countdown.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create a minimal style.css so the page renders**

```css
/* Minimal reset to verify structure */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0a0f; color: #e8e4df; font-family: 'Segoe UI', system-ui, sans-serif; }
```

- [ ] **Step 3: Create empty countdown.js placeholder**

```js
// Countdown logic — implemented in Task 4
```

- [ ] **Step 4: Open in browser and verify structure renders**

```bash
# Start a simple local server for testing
python3 -m http.server 8080 --directory /home/brian/Websites &
```

Open `http://192.168.4.6:8080` on phone/browser. Verify: page loads, dark background, white text visible for hero content and countdown placeholders showing `--`.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css countdown.js
git commit -m "feat: add HTML skeleton with hero and countdown sections"
```

---

### Task 3: Full CSS Styling

**Files:**
- Modify: `style.css`

Implement the complete visual design from the spec — all sections, color palette, typography, responsive mobile-first layout. This task styles everything including sections that don't have HTML yet (those selectors will be ready when the HTML is added in Task 5).

- [ ] **Step 1: Write the complete stylesheet**

```css
/* ============================================
   REN & AIKO — Manga Release Countdown
   Mobile-first, dark theme, rose/mauve accents
   ============================================ */

/* --- Reset & Base --- */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #0a0a0f;
  color: #e8e4df;
  font-family: 'Segoe UI', system-ui, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* --- Hero --- */
.hero {
  background: linear-gradient(180deg, #1a1028 0%, #0f0f1a 100%);
  padding: 56px 24px 36px;
  text-align: center;
  border-bottom: 1px solid #2a1f3d;
}

.genre-tags {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.genre-tag {
  background: rgba(199, 130, 175, 0.15);
  color: #c782af;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.manga-title {
  font-size: 38px;
  font-weight: 300;
  letter-spacing: 8px;
  margin-bottom: 6px;
  background: linear-gradient(135deg, #f5e6d3 0%, #c782af 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.manga-subtitle {
  font-size: 13px;
  color: #7f8c9b;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 24px;
}

.volume-badge {
  display: inline-block;
  border: 1px solid #c782af;
  color: #c782af;
  padding: 6px 20px;
  border-radius: 4px;
  font-size: 11px;
  letter-spacing: 2px;
}

/* --- Countdown --- */
.countdown-section {
  background: linear-gradient(180deg, #0f0f1a 0%, #0d1117 100%);
  padding: 36px 24px;
  text-align: center;
}

.countdown-label {
  font-size: 11px;
  color: #7f8c9b;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 20px;
}

.countdown-timer {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.time-unit {
  background: rgba(199, 130, 175, 0.08);
  border: 1px solid rgba(199, 130, 175, 0.2);
  border-radius: 10px;
  padding: 14px 8px;
  min-width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.time-number {
  font-size: 34px;
  font-weight: 200;
  color: #f5e6d3;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.time-label {
  font-size: 9px;
  color: #7f8c9b;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 6px;
}

/* --- Section Headers (shared) --- */
.section-header {
  font-size: 11px;
  color: #c782af;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 400;
}

.section-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(199, 130, 175, 0.3), transparent);
}

/* --- Synopsis --- */
.synopsis {
  padding: 36px 24px;
  border-top: 1px solid #1a1a2e;
}

.synopsis-text {
  font-size: 15px;
  line-height: 1.9;
  color: #b8b0a8;
  font-style: italic;
}

/* --- Characters --- */
.characters {
  padding: 36px 24px;
  border-top: 1px solid #1a1a2e;
}

.char-card {
  background: rgba(26, 16, 40, 0.5);
  border: 1px solid #2a1f3d;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}

.char-image {
  background: #f5f0eb;
  overflow: hidden;
}

.char-image img {
  width: 100%;
  object-fit: cover;
}

.char-info {
  padding: 18px;
}

.char-name {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: 4px;
  margin-bottom: 4px;
}

.char-role {
  font-size: 11px;
  color: #c782af;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.char-desc {
  font-size: 13px;
  color: #7f8c9b;
  line-height: 1.7;
}

/* --- Preview Panels --- */
.preview {
  padding: 36px 24px;
  border-top: 1px solid #1a1a2e;
}

.preview-panel {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}

.preview-panel img {
  width: 100%;
}

/* --- Footer --- */
.site-footer {
  padding: 36px 24px;
  text-align: center;
  border-top: 1px solid #1a1a2e;
  color: #3a3a4a;
  font-size: 11px;
  letter-spacing: 1px;
}

/* --- Reveal Overlay --- */
.reveal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: #0a0a0f;
  z-index: 1000;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.reveal-overlay.active {
  display: block;
  animation: revealFadeIn 1.5s ease-out;
}

.reveal-content {
  max-width: 420px;
  margin: 0 auto;
  padding: 48px 24px 64px;
  text-align: center;
}

.reveal-badge {
  font-size: 11px;
  color: #c782af;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 24px;
  animation: revealSlideUp 1s ease-out 0.5s both;
}

.reveal-cover-frame {
  border: 2px solid #c782af;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 32px;
  box-shadow: 0 0 60px rgba(199, 130, 175, 0.2);
  animation: revealScale 1.2s ease-out 0.3s both;
}

.reveal-cover-frame img {
  width: 100%;
}

.reveal-message {
  font-size: 15px;
  line-height: 1.9;
  color: #b8b0a8;
  text-align: left;
  animation: revealSlideUp 1s ease-out 1.2s both;
  padding: 0 4px;
}

.reveal-signature {
  margin-top: 32px;
  font-size: 13px;
  color: #c782af;
  letter-spacing: 2px;
  animation: revealSlideUp 1s ease-out 1.6s both;
}

/* --- Countdown "released" state --- */
.released-badge {
  display: none;
  font-size: 14px;
  color: #c782af;
  letter-spacing: 3px;
  text-transform: uppercase;
  padding: 12px 24px;
  border: 1px solid #c782af;
  border-radius: 8px;
  animation: pulse 2s ease-in-out infinite;
}

.page-released .countdown-timer { display: none; }
.page-released .countdown-label { display: none; }
.page-released .released-badge { display: inline-block; }

/* --- Animations --- */
@keyframes revealFadeIn {
  from { opacity: 0; background: #fff; }
  to { opacity: 1; background: #0a0a0f; }
}

@keyframes revealScale {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes revealSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 2: Open in browser and verify visual design**

Open `http://192.168.4.6:8080`. Verify on mobile viewport (375px):
- Dark background with hero section styled correctly
- Gradient title text visible
- Genre tags as rose pill badges
- Countdown boxes with rose borders
- All spacing looks right

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add complete CSS styling with color palette and animations"
```

---

### Task 4: Countdown JavaScript Logic

**Files:**
- Modify: `countdown.js`

Implement the live countdown timer targeting April 1, 2026 at 23:00 Pacific, the reveal trigger, and localStorage persistence.

- [ ] **Step 1: Write countdown.js with timer logic**

```js
(function () {
  // April 1, 2026 at 11:00 PM US Pacific (PDT = UTC-7 in April)
  // Using explicit timezone offset: 2026-04-01T23:00:00-07:00
  const TARGET = new Date('2026-04-01T23:00:00-07:00').getTime();
  const STORAGE_KEY = 'ren-aiko-revealed';

  const $days = document.getElementById('days');
  const $hours = document.getElementById('hours');
  const $minutes = document.getElementById('minutes');
  const $seconds = document.getElementById('seconds');
  const $page = document.getElementById('page');
  const $overlay = document.getElementById('reveal-overlay');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function showReveal() {
    localStorage.setItem(STORAGE_KEY, 'true');
    $page.classList.add('page-released');
    $overlay.classList.add('active');
  }

  function tick() {
    var now = Date.now();
    var diff = TARGET - now;

    if (diff <= 0) {
      $days.textContent = '00';
      $hours.textContent = '00';
      $minutes.textContent = '00';
      $seconds.textContent = '00';
      showReveal();
      return;
    }

    var totalSeconds = Math.floor(diff / 1000);
    var d = Math.floor(totalSeconds / 86400);
    var h = Math.floor((totalSeconds % 86400) / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;

    $days.textContent = pad(d);
    $hours.textContent = pad(h);
    $minutes.textContent = pad(m);
    $seconds.textContent = pad(s);
  }

  // Check if already revealed on a previous visit
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    // Still check if countdown has actually passed (prevent premature reveal
    // if someone manually set localStorage)
    if (Date.now() >= TARGET) {
      showReveal();
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Start ticking
  tick();
  setInterval(tick, 1000);
})();
```

- [ ] **Step 2: Verify countdown is ticking in the browser**

Open `http://192.168.4.6:8080`. Verify:
- Numbers appear instead of `--`
- Seconds tick down every second
- Days/hours/minutes are reasonable for the time remaining until April 1

- [ ] **Step 3: Test the reveal trigger by temporarily changing TARGET**

Temporarily change the TARGET date to 5 seconds in the future in the browser console or by editing the file. Verify:
- Timer counts down to 00:00:00:00
- Reveal overlay does NOT appear yet (because the overlay HTML isn't in index.html yet — that's fine, just confirm no JS errors in the console)

Revert the TARGET back to the real date after testing.

- [ ] **Step 4: Commit**

```bash
git add countdown.js
git commit -m "feat: add countdown timer with reveal trigger and localStorage"
```

---

### Task 5: Remaining HTML Sections

**Files:**
- Modify: `index.html`

Add the synopsis, character profiles, chapter preview, footer, and reveal overlay to the HTML.

- [ ] **Step 1: Add synopsis section after countdown**

Insert after the closing `</section>` of the countdown section:

```html
    <!-- Section 3: Synopsis -->
    <section class="synopsis">
      <h2 class="section-header">Synopsis</h2>
      <p class="synopsis-text">
        Separated by oceans and time zones, Ren counts the days until he can hold Aiko again.
        Through late-night messages and shared silences, their love stretches across the distance&nbsp;&mdash;
        bending but never breaking. Now, after years apart, the final chapter is about to begin&hellip;
      </p>
    </section>
```

- [ ] **Step 2: Add character profiles section**

Insert after synopsis section:

```html
    <!-- Section 4: Characters -->
    <section class="characters">
      <h2 class="section-header">Characters</h2>

      <div class="char-card">
        <div class="char-image">
          <img src="assets/aiko-profile.png" alt="Aiko — character reference sheet" loading="lazy">
        </div>
        <div class="char-info">
          <h3 class="char-name">AIKO LIN</h3>
          <p class="char-role">Female Lead</p>
          <p class="char-desc">Shortest in class, biggest in heart. Her expressions range from soft vulnerability to teasing smugness&nbsp;&mdash; but her smile is what Ren carries with him across every mile.</p>
        </div>
      </div>

      <div class="char-card">
        <div class="char-image">
          <img src="assets/ren-aiko-portraits.png" alt="Ren — character portrait" loading="lazy">
        </div>
        <div class="char-info">
          <h3 class="char-name">REN</h3>
          <p class="char-role">Male Lead</p>
          <p class="char-desc">The one who waits. Patient and steady, Ren holds onto the promise that distance is temporary&nbsp;&mdash; but love is not.</p>
        </div>
      </div>
    </section>
```

- [ ] **Step 3: Add chapter preview section**

Insert after characters section:

```html
    <!-- Section 5: Chapter 1 Preview -->
    <section class="preview">
      <h2 class="section-header">Chapter 1 Preview</h2>
      <div class="preview-panel">
        <img src="assets/preview-panels-1.png" alt="Chapter 1 preview — page 1" loading="lazy">
      </div>
      <div class="preview-panel">
        <img src="assets/preview-panels-2.png" alt="Chapter 1 preview — page 2" loading="lazy">
      </div>
      <div class="preview-panel">
        <img src="assets/preview-collage.png" alt="Chapter 1 preview — daily life" loading="lazy">
      </div>
    </section>
```

- [ ] **Step 4: Add footer**

Insert after preview section:

```html
    <!-- Section 6: Footer -->
    <footer class="site-footer">
      &copy; 2026 Ren & Aiko&nbsp;&mdash; All chapters are real.
    </footer>
```

- [ ] **Step 5: Add the released badge inside the countdown section**

Inside the `countdown-section`, after the `countdown-timer` div, add:

```html
      <div class="released-badge">NOW AVAILABLE — VOLUME 1</div>
```

- [ ] **Step 6: Add reveal overlay before closing `</body>`**

Insert before `<script src="countdown.js"></script>`:

```html
  <!-- Reveal Overlay (shown when countdown reaches zero) -->
  <div class="reveal-overlay" id="reveal-overlay">
    <div class="reveal-content">
      <p class="reveal-badge">NOW AVAILABLE</p>

      <div class="reveal-cover-frame">
        <img src="assets/cover.png" alt="Ren & Aiko — Volume 1 Cover">
      </div>

      <div class="reveal-message">
        <p>I thank God for the many blessings I've received and amongst some of the best blessings like my mom's love and her health, my family's well being and health, business being afloat and my strength and health to continue onwards... is one blessing that I don't think anyone expected and that's the blessing of reconnecting with you because since that moment, life has been fulfilling and I find happiness and joy whenever I'm chatting with you, or thinking about you.</p>
        <br>
        <p>As we continue to grow, I pray that my love for you matures and I pray that our focus on health and happiness only changes for the better. I pray that I never forget that my goal is to make our lives better and if I ever forget, or my actions do not reflect that, that I am reminded so that I can switch gears into actions that align with a healthy life for us.</p>
        <br>
        <p>If you're reading this, that means we're reunited physically... so I won't drag this out so I can let you go back to spending time. Have fun ;)</p>
      </div>

      <p class="reveal-signature">— Ren</p>
    </div>
  </div>
```

- [ ] **Step 7: Verify in browser**

Open `http://192.168.4.6:8080`. Verify:
- All 6 sections render and scroll properly
- Images load from assets/
- Character cards show the artwork with info below
- Preview panels display full-width
- Footer text is subtle at the bottom

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: add synopsis, characters, preview, footer, and reveal overlay"
```

---

### Task 6: Reveal Animation End-to-End Test

**Files:**
- Modify: `countdown.js` (temporary test, then revert)

Test the full reveal flow by temporarily setting the countdown to a few seconds in the future.

- [ ] **Step 1: Temporarily set TARGET to 5 seconds from now for testing**

Edit `countdown.js` — change the TARGET line to:

```js
  const TARGET = Date.now() + 5000; // TESTING ONLY — remove after test
```

- [ ] **Step 2: Open in browser and watch the reveal**

Open `http://192.168.4.6:8080`. Verify:
- Countdown ticks from 5 to 0
- Screen flashes white briefly then fades to dark
- Cover image scales up with a glow border
- "NOW AVAILABLE" badge fades in above the cover
- Personal message text fades in below after a short delay
- "— Ren" signature fades in last
- Page behind the overlay shows "NOW AVAILABLE — VOLUME 1" instead of the timer

- [ ] **Step 3: Test localStorage persistence**

Refresh the page. Verify:
- Reveal overlay shows immediately (no countdown)
- This confirms localStorage is working

- [ ] **Step 4: Clear localStorage and revert TARGET**

In browser console: `localStorage.removeItem('ren-aiko-revealed')`

Revert `countdown.js` TARGET back to:

```js
  const TARGET = new Date('2026-04-01T23:00:00-07:00').getTime();
```

- [ ] **Step 5: Verify countdown is back to normal**

Refresh the page. Verify the countdown is showing the real days/hours/minutes until April 1.

- [ ] **Step 6: Commit the reverted file**

```bash
git add countdown.js
git commit -m "test: verify reveal animation end-to-end, revert test changes"
```

---

### Task 7: Mobile Polish and Final Review

**Files:**
- Modify: `style.css` (if adjustments needed)
- Modify: `index.html` (if adjustments needed)

Final pass for mobile experience: test on an actual phone-width viewport, check image loading performance, verify scrolling is smooth.

- [ ] **Step 1: Test on mobile viewport**

Use browser DevTools mobile emulation (iPhone SE, iPhone 12, iPhone 14 Pro) or open on actual phone at `http://192.168.4.6:8080`. Check:
- All text is readable without zooming
- Images don't overflow the viewport
- Countdown numbers are large enough to read
- Scrolling is smooth through all sections
- No horizontal scroll anywhere

- [ ] **Step 2: Fix any mobile issues found**

Apply CSS fixes as needed. Common issues to watch for:
- Images too wide: already handled by `img { max-width: 100%; }`
- Title too wide on small screens: may need to reduce `letter-spacing` or `font-size` on narrow viewports
- Timer boxes too wide: already using `min-width: 68px` with `gap: 12px` — total ~308px, fits on 375px screens

If title overflows, add a media query:

```css
@media (max-width: 360px) {
  .manga-title {
    font-size: 30px;
    letter-spacing: 4px;
  }
}
```

- [ ] **Step 3: Add meta tags for social sharing**

In case Aiko opens the link from a text message and the preview loads, add to `<head>` in `index.html`:

```html
  <meta property="og:title" content="REN & AIKO — Volume 1">
  <meta property="og:description" content="A Story of Distance & Devotion. Coming Soon.">
  <meta property="og:image" content="assets/aiko-expressions.png">
  <meta name="theme-color" content="#0a0a0f">
```

- [ ] **Step 4: Final visual review**

Scroll through the entire page one more time. Check:
- Hero section: gradient title, genre tags, volume badge all look polished
- Countdown: ticking, numbers stable (no width jitter)
- Synopsis: italic text, readable on dark background
- Characters: images load, cards look balanced
- Preview: manga panels display full-width, no distortion
- Footer: subtle, doesn't draw attention

- [ ] **Step 5: Commit**

```bash
git add index.html style.css
git commit -m "feat: mobile polish, social meta tags, final review pass"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Copy assets from NAS | `assets/*.png` |
| 2 | HTML skeleton (hero + countdown) | `index.html`, `style.css`, `countdown.js` |
| 3 | Complete CSS styling | `style.css` |
| 4 | Countdown JS logic | `countdown.js` |
| 5 | Remaining HTML sections + reveal overlay | `index.html` |
| 6 | End-to-end reveal test | `countdown.js` (temp edit + revert) |
| 7 | Mobile polish + final review | `style.css`, `index.html` |
