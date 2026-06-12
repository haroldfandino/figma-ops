# figma-ops

Design-ops toolkit for getting **websites and images into Figma/FigJam, and building
consistent FigJam diagrams** — built to be driven by AI agents (Claude Code, Cursor,
or any MCP-capable client), but every script also works standalone from a terminal.

Born from a real workflow: auditing live websites, diagramming their current state and a
proposed redesign in FigJam, and building moodboards from full-page screenshots of
reference sites.

## What's inside

```
scripts/
  webshot.js        # full-page website screenshot (puppeteer + your installed Chrome)
  split-image.js    # split tall screenshots so Figma can render them (Node + sharp)
  split-image.ps1   # same, Windows-only zero-dependency fallback (System.Drawing)
  figma-upload.js   # POST an image to a Figma MCP upload URL (Node, cross-platform)
  figma-upload.ps1  # same, PowerShell fallback (curl.exe)
  figma-info.js     # read file/page/node structure via the Figma REST API (needs token)
skills/
  webshot/          # agent playbook: capturing any site (incl. authenticated pages)
  figma-images/     # agent playbook: the upload -> split -> fill pipeline + gotchas
  figma-diagrams/   # agent playbook: FigJam diagram factories and layout patterns
boards/
  example.json      # per-project board config template (file key, page IDs, style tokens)
```

## Setup

```bash
npm install        # puppeteer-core + sharp (no bundled Chromium; uses your Chrome)
```

Requirements: Node 18+, Google Chrome installed. Set `CHROME_PATH` if Chrome lives in a
non-standard location.

### Access to Figma — two mechanisms, you usually want both

**1. Figma MCP server (required for writing to files).** All *write* operations — creating
shapes, applying image fills, editing diagrams — go through Figma's MCP server, which any
MCP-capable agent can use:

- **Claude Code:** `claude mcp add --transport http figma https://mcp.figma.com/mcp`
  then run `/mcp` → Authenticate (OAuth, one-time consent).
- **Cursor / Claude.ai / other MCP clients:** add a custom MCP server pointing at
  `https://mcp.figma.com/mcp`. Figma supports Dynamic Client Registration — no
  pre-registration needed; you'll get a one-time browser consent flow.
- **Figma desktop app (alternative, local):** enable the Dev Mode MCP server in
  Preferences; it listens on `http://127.0.0.1:3845/mcp`.

The MCP server exposes the tools these playbooks rely on: `use_figma` (run Plugin-API
JavaScript in a file — works in Figma design files, FigJam, and Slides), `upload_assets`
(get single-use image upload URLs), `get_figjam` / `get_design_context` /
`get_metadata` (read structure), and `get_screenshot`.

**2. Figma personal access token (for REST reads / non-MCP agents).** The REST API is
read-only for our purposes but lets any script or LLM inspect files without MCP:

1. figma.com → your avatar → **Settings** → **Security** tab → **Personal access tokens**
   → *Generate new token*.
2. Scopes: **File content → Read-only** is enough for `figma-info.js` (add *Dev resources*
   read if you use Dev Mode endpoints).
3. Store it as an environment variable — never commit it:
   - PowerShell: `$env:FIGMA_TOKEN = "figd_..."` (or set it user-wide in System settings)
   - bash/zsh: `export FIGMA_TOKEN="figd_..."`
4. Test: `node scripts/figma-info.js <fileKey>` — lists pages and top-level nodes.

> Note: the public REST API cannot *edit* files. Writes require the MCP server (or a
> Figma plugin). That's why the pipeline below mixes both.

## The workflow

### A. Capture a website

```bash
node scripts/webshot.js https://example.com example
# -> captures/example_full.png, prints "example 1512x<height>"
```

- Auto-scrolls to trigger lazy-loading, removes cookie/consent overlays, captures the
  true full page. Flags: `--no-scroll`, `--keep-overlays`, `--width=`, `--wait=ms`, `--out=DIR`.
- **Scroll-jacked / 100vh sites** (full-viewport experiences): if the full-page result is a
  stretched hero, re-capture with `--no-scroll` and accept a viewport shot.
- **Authenticated pages:** headless Chrome has no session. Open the URL in the user's
  running Chrome (`chrome --new-window <url>`) and capture the window rect at OS level
  (see `skills/webshot/SKILL.md` for the Windows recipe).

### B. Split if tall (Figma render limit)

Figma clients fail to render images taller than **~8000px** (empirically: 7811px rendered,
10203px did not). Split before uploading:

```bash
node scripts/split-image.js captures/example_full.png            # splits only if needed
node scripts/split-image.js captures/big.png --jpeg=85           # heavy PNGs: JPEG parts
```

Prints each part's size plus the display height for a 720-wide box
(`display_h = source_h * 720 / source_w`).

### C. Place into Figma/FigJam

1. **Create target boxes** (via MCP `use_figma`): in FigJam use `ShapeWithText` SQUAREs;
   in Figma design files use rectangles/frames. Size them `720 x display_h`; stack split
   parts seamlessly (`part2.y = part1.y + part1.height`).
2. **Get upload URLs**: call MCP `upload_assets` with `{fileKey, nodeId, scaleMode: "FILL"}`
   — one call per image. URLs are **single-use and expire in 10 minutes**.
3. **POST the file**:
   ```bash
   node scripts/figma-upload.js captures/example_p1.png "<submitUrl>"
   ```
   The JSON response contains an `imageHash`.
4. **Apply the fill yourself** — on FigJam shapes the upload does *not* auto-apply:
   ```js
   const n = await figma.getNodeByIdAsync('<box id>');
   n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }];
   ```
5. Verify with `await node.screenshot()` in the same `use_figma` call.

### D. Diagramming (FigJam)

`skills/figma-diagrams/SKILL.md` contains paste-ready factory functions (shapes, sections,
connectors, text) and three battle-tested layout patterns: **page-anatomy spine**
(current-state/proposal page diagrams), **sitemap tree**, and **detail-section grids** —
with the exact pixel math so diagrams come out aligned every time.

## Per-project board config

Keep project specifics (file key, page IDs, style tokens, node inventory) out of this repo
in a small JSON per board — see `boards/example.json`. Point your project's agent context
(CLAUDE.md / AGENTS.md / .cursorrules) at this repo and at the board config.

## Using with AI agents

- **Claude Code:** copy or symlink the `skills/*` folders into your project's
  `.claude/skills/`, or reference this repo from your `CLAUDE.md`.
- **Other agents:** `AGENTS.md` in this repo carries the same instructions in the emerging
  cross-agent convention; the SKILL.md files are plain markdown any agent can read.
- Everything writes through standard MCP + standard shell commands — no Claude-only APIs.

## Platform notes

- `webshot.js`, `split-image.js`, `figma-upload.js`, `figma-info.js`: cross-platform (Node).
- `*.ps1` fallbacks: Windows only, zero npm dependencies.
- Chrome path autodetection covers Windows/macOS/Linux defaults; override with `CHROME_PATH`.

## License

MIT
