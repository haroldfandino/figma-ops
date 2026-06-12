---
name: webshot
description: Capture full-page website screenshots for moodboards, before/after exhibits, or design references. Use when asked to screenshot a webpage or collect visual references. Handles lazy-loading, cookie banners, scroll-jacked sites, and authenticated pages.
---

# webshot — full-page website capture

Run from the figma-ops repo root (`npm install` once; needs local Chrome, override path
with `CHROME_PATH`).

```bash
node scripts/webshot.js <url> <name> [--out=DIR]
# -> DIR/<name>_full.png (default ./captures), prints "name 1512x<height>"
```

Flags: `--no-scroll` | `--keep-overlays` | `--width=1512` | `--wait=2500`.

## Decision guide

- **Normal pages**: defaults work — auto-scroll triggers lazy-loading, cookie/consent
  overlays are removed from the DOM, capture is true full page.
- **Scroll-jacked / 100vh sites** (full-viewport experiences, animated heroes): a full-page
  capture may come back as a stretched hero filling thousands of pixels. Inspect the result;
  if distorted, re-capture with `--no-scroll` and use the viewport shot. Tell the user why.
- **Authenticated pages**: headless Chrome has no session. Options, in order:
  1. Drive the user's logged-in browser via your browser tool if you have one (can view,
     usually cannot save files).
  2. Open the page in the user's *running* Chrome (`chrome --new-window <url>` uses their
     profile + session) and capture the foreground window rect at OS level. On Windows:
     user32 `GetForegroundWindow` + `GetWindowRect` + `Graphics.CopyFromScreen`. Warn the
     user a window will pop up; never touch login forms or verification codes yourself.
- **Element of unknown height**: capture first, read the printed height, then decide on
  splitting (see the figma-images skill: split anything over ~8000px).

## Quality check

Always view the output image before using it. Common failure smells: large uniform areas
(unrendered video), repeated stretched pixels (scroll-jack), a centered island layout
(fixed-viewport design), or a cookie wall that survived (re-run with a custom DOM removal).
