# REN & AIKO — A Story of Distance & Devotion

A manga publisher-themed countdown website counting down to a reunion.

## Live Site

**URL:** https://linhyeh.brianpham.us

## Structure

```
index.html      — Single-page site with 6 sections + reveal overlay
style.css       — Dark theme, rose/mauve accents, mobile-first
countdown.js    — Live timer targeting April 1, 2026 11PM Pacific
assets/         — Manga artwork (character sheets, panels, cover)
```

## Sections

1. **Hero** — Title, genre tags, volume badge
2. **Countdown** — Live ticking timer
3. **Synopsis** — Publisher-style story blurb
4. **Characters** — Aiko Lin & Ren character cards with artwork
5. **Chapter 1 Preview** — Manga panel pages
6. **Footer** — "All chapters are real."

## Reveal

When the countdown hits zero, the page transforms:
- Screen flashes white, fades to dark
- Cover image (Snorlax hoodie illustration) scales up with glow
- Personal message fades in
- localStorage remembers the reveal for return visits

## Hosting

- **GitHub Pages** from `main` branch
- **Custom domain** `linhyeh.brianpham.us` via CNAME in GoDaddy DNS
- CNAME record: `linhyeh` → `Relax-Snorlax.github.io`

## Artwork Source

Images sourced from NAS: `\\nas3\brian\Brian Pham - Personal\Photo and Memories\Aiko\`

## Tech

Static HTML/CSS/JS. No frameworks, no build step, no dependencies.
