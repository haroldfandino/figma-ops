---
name: figma-images
description: Place image files into Figma or FigJam via the Figma MCP server - moodboards, screenshots, before/after exhibits. Use whenever an image file needs to appear inside a Figma/FigJam file. Covers the upload_assets -> POST -> imageHash fill pipeline, the ~8000px render limit, and splitting tall images.
---

# figma-images — images into Figma/FigJam

Requires the Figma MCP server connected (see repo README → Setup). Pipeline:

## 1. Split tall images first

Figma clients fail to render images taller than **~8000px** (empirical: 7811 OK, 10203
broken). Check the source height; if over the limit:

```bash
node scripts/split-image.js <image.png>              # parts under 8000px each
node scripts/split-image.js <image.png> --jpeg=85    # heavy PNGs (>3MB): JPEG parts
```

It prints each part's display height for a 720-wide box (`display_h = src_h * 720 / src_w`).

## 2. Create target nodes (use_figma)

- **FigJam** (`figma.com/board/...`): `figma.createShapeWithText()` with
  `shapeType = 'SQUARE'`, resized to `720 x display_h`.
- **Figma design** (`figma.com/design/...`): `figma.createRectangle()` or a frame.
- For split images, stack parts seamlessly: same x, `part2.y = part1.y + part1.height`.
  Advise the user to group the parts so they move together.
- **Read existing positions before placing** — users rearrange canvases between calls.

## 3. Get upload URLs (upload_assets MCP tool)

Call `upload_assets` with `{ fileKey, nodeId: <target node>, scaleMode: "FILL" }` — one
call per image (count must be 1 when nodeId is set; calls may run in parallel).
URLs are **single-use and expire in 10 minutes** — don't request them until files are ready.

## 4. POST each file

```bash
node scripts/figma-upload.js <file> "<submitUrl>"
```

Response JSON contains `imageHash`. **10MB cap is handled for you:** if the file is larger,
the script auto-encodes a fitting JPEG copy (progressive quality, then downscale) and
uploads that, printing an `[auto-jpeg]` line. Dense full-width captures (>1512px wide) are
the usual trigger. No manual compression step needed; `--keep` retains the `.upload.jpg`.

## 5. Apply the fill manually (the critical gotcha)

The upload does **not** auto-apply to FigJam shapes even with nodeId set. In `use_figma`:

```js
const n = await figma.getNodeByIdAsync('<node id>');
n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }];
```

`FILL` crops on aspect mismatch; size the box to the image's aspect to avoid cropping
(or use `FIT`). Verify with `await node.screenshot()` in the same call — note this proves
the *server* renders it; a user's client may still choke on oversized images (step 1).

## Moodboard pattern (FigJam)

Section (fill `#F9F9F9`); one column per reference: caption TEXT (Inter Medium 16) at
`y=48`, image box at `y=80`; columns at `x = 48 + i*784` (720 box + 64 gap). Grow the
section afterward: `height = max(child.y + child.height) + 48`. Use a separate section
(e.g. fill `#FFF5F5`) for "before/current state" exhibits so they read differently from
references.
