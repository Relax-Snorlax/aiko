# Ren & Aiko — Manga Release Countdown Website

## Overview

A mobile-first countdown website disguised as a manga publisher's pre-release page. The manga "Ren & Aiko" is a romantic story that mirrors the real love story between Brian and Aiko Lin. The countdown targets **Wednesday, April 1, 2026 at 11:00 PM** (local time) — the moment they reunite after years apart.

Aiko will receive the link beforehand and watch the countdown from afar. She'll recognize the names and understand the true meaning, but the craft of the manga-site illusion is the love letter itself.

## Target

- **Primary device**: Mobile phone
- **Audience**: Aiko (single viewer)
- **Countdown target**: April 1, 2026 at 23:00 US Pacific (America/Los_Angeles)
- **Artwork source**: `/mnt/nas3/brian/Brian Pham - Personal/Photo and Memories/Aiko/` — ~25 PNG images including character design sheets, colored illustrations, and manga panel pages

## Page Structure (Pre-Countdown)

The site is a single scrollable page with 6 sections, styled to look like a premium manga publisher's release announcement.

### Section 1: Hero

- Title: "REN & AIKO" in large gradient text (warm cream to rose)
- Genre tags: "Romance" and "Slice of Life" as pill badges
- Subtitle: "A Story of Distance & Devotion"
- Volume badge: "VOLUME 1 — FIRST EDITION"

### Section 2: Countdown Timer

- Label: "Official Release Date"
- Four time unit boxes: Days, Hours, Minutes, Seconds
- Live-ticking JavaScript countdown to April 1, 2026 23:00
- Styled with rose/mauve accent borders on dark background
- Tabular numerals for stable width during ticking

### Section 3: Synopsis

- Section header: "Synopsis" with decorative trailing line
- Publisher-style blurb in italic, written as a back-cover description
- Content: A poetic description of love across distance, ending with the promise that "the final chapter is about to begin"

### Section 4: Character Profiles

- Section header: "Characters"
- Two character cards, each with:
  - **Image area**: Line art from the character reference sheets
  - **Name**: Large, letter-spaced
  - **Role**: "Female Lead" / "Male Lead" in accent color
  - **Description**: Short character blurb written in manga-publisher style
- Aiko's card uses the full-body reference sheet or expression sheet
- Ren's card uses art cropped from the couple illustrations

### Section 5: Chapter 1 Preview

- Section header: "Chapter 1 Preview"
- The manga panel pages displayed as preview content
- Uses the dialogue panels (morning routine, "You can rest" conversation, reunion cuddling scene)
- Displayed as full-width images in rounded containers

### Section 6: Footer

- Subtle, understated: "&copy; 2026 Ren & Aiko — All chapters are real."

## Cover Reveal (Post-Countdown)

When the countdown reaches zero, the page transforms:

1. **Animation**: The page fades to white/bright, then the cover image scales up from center with a soft glow — total duration ~2 seconds. CSS keyframe animation, no JS animation library needed.
2. **Cover image**: The Snorlax hoodie cuddling illustration (`68D955D4-3FAD-4A96-840E-EE1708EA59C5.PNG`) displayed as the official manga cover, framed with a decorative border
3. **Personal message**: The following note from Brian fades in below the cover after a short delay:

> I thank God for the many blessings I've received and amongst some of the best blessings like my mom's love and her health, my family's well being and health, business being afloat and my strength and health to continue onwards... is one blessing that I don't think anyone expected and that's the blessing of reconnecting with you because since that moment, life has been fulfilling and I find happiness and joy whenever I'm chatting with you, or thinking about you. As we continue to grow, I pray that my love for you matures and I pray that our focus on health and happiness only changes for the better. I pray that I never forget that my goal is to make our lives better and if I ever forget, or my actions do not reflect that, that I am reminded so that I can switch gears into actions that align with a healthy life for us. If you're reading this, that means we're reunited physically... so I won't drag this out so I can let you go back to spending time. Have fun ;)
4. **State change**: The countdown section transforms to "NOW AVAILABLE — VOLUME 1" and the timer is replaced with a release confirmation

The reveal should feel like unwrapping a gift — not instant, but a brief, satisfying animation. The pre-countdown sections (synopsis, characters, preview) remain scrollable below.

## Visual Design

### Color Palette

- **Background**: Deep dark blue-black (`#0a0a0f`)
- **Primary text**: Warm off-white (`#e8e4df`)
- **Accent**: Rose/mauve (`#c782af`)
- **Secondary text**: Muted blue-gray (`#7f8c9b`)
- **Card backgrounds**: Semi-transparent deep purple (`rgba(26, 16, 40, 0.5)`)
- **Borders**: Subtle dark purple (`#2a1f3d`) and dark navy (`#1a1a2e`)

### Typography

- System font stack (`'Segoe UI', system-ui, sans-serif`)
- Title: Light weight (300), wide letter-spacing
- Section headers: Small caps, letter-spaced, accent color with trailing decorative line
- Body text: Regular weight, generous line height (1.8)
- Numbers: Tabular numerals for countdown stability

### Art Treatment

- Line art displayed on light cream backgrounds (`#f5f0eb`) to preserve the pencil-on-paper feel
- Colored illustrations displayed full-bleed or in rounded containers
- Manga panels shown at full width with slight border radius

## Artwork Inventory & Assignment

| File | Content | Used For |
|------|---------|----------|
| `305228D6-...*.PNG` (multiple) | Aiko character head views & reference | Character profile card |
| `3CEF80F3-...PNG` | Full body reference + expressions sheet | Character profile card (alternate) |
| `89A0D4CC-...PNG` | Full body reference + expanded expressions | Character profile card (alternate) |
| `DCF5F64C-...PNG` | Ren & Aiko lying in bed portraits | Preview/atmosphere |
| `E81EA405-...PNG` | Aiko full body standing (line art) | Character profile |
| `7B17FF64-...PNG` | Aiko full body standing rear view (line art) | Character profile (alternate) |
| `CD32E95B-...PNG` | Aiko full body standing (line art, alternate) | Character profile (alternate) |
| `BFE73DB2-...PNG` | Aiko pose sheet (sitting, lying, various) | Chapter preview / atmosphere |
| `DDD5A96D-...PNG` | Aiko pose sheet (alternate set) | Chapter preview / atmosphere |
| `AD8602A8-...PNG` | Aiko expression close-ups (5 expressions) | Chapter preview |
| `F4FA9FB1-...PNG` | Aiko expression close-ups (duplicate/variant) | Not used (duplicate) |
| `68D955D4-...PNG` | **Snorlax hoodie cuddling (colored)** | **Cover reveal image** |
| `07031AAE-...PNG` | Close-up embrace, eyes closed (colored) | Possible reveal alternate |
| `4D9F539B-...PNG` | Couple collage — daily life scenes (colored) | Chapter preview |
| `D867C2B5-...PNG` | Couple collage (variant of above) | Not used (duplicate) |
| `32B47022-...PNG` | Manga panels with dialogue (colored) | Chapter 1 preview |
| `6E9408EA-...PNG` | Manga panels with dialogue (variant) | Chapter 1 preview (alternate) |
| `1727DF1D-...PNG` | Manga panels — reunion cuddling (B&W) | Chapter 1 preview |
| `IMG_0275.PNG` | BMW E39 M5 Wikipedia screenshot | Not used (unrelated) |
| `IMG_0276.PNG` | Unknown (could not read) | Check manually |
| `Bending Stainless Steel Rods Guide.PNG` | Reference guide | Not used (unrelated) |

## Technical Approach

- **Static HTML/CSS/JS** — no framework, no build step
- **Single `index.html` file** with embedded CSS and JS
- **Images copied** from NAS into project `assets/` directory
- **Countdown logic**: JavaScript `setInterval` comparing against target timestamp
- **Reveal logic**: When countdown reaches zero, CSS class toggles to show/hide sections with animation
- **No server required**: Can be hosted as a static file (GitHub Pages, Netlify, or simple file server)
- **localStorage**: Remember if reveal has already happened so returning visits show the revealed state

## What Makes It Special

1. **The illusion**: It looks like a real manga publisher site — the craft IS the message
2. **The recognition moment**: When Aiko sees her name in the character profile and recognizes the art
3. **The shared anticipation**: Watching the seconds tick down together, even while apart
4. **Real artwork**: Every illustration is custom, personal, meaningful
5. **The reveal**: The countdown ending transforms into a love letter
6. **The details**: The footer ("All chapters are real"), the synopsis that tells their actual story, the character descriptions that describe the real people
7. **"Shortest in class"**: Pulled directly from the character reference sheet — Aiko will know these details are about her
