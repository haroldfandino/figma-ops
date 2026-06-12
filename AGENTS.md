# figma-ops — agent instructions

This repo is a toolkit for AI agents (and humans) to capture websites and place
images/diagrams into Figma and FigJam. Full setup and workflow: `README.md`.

## Capabilities you need

1. **Shell access** to run Node scripts (`npm install` once; Node 18+, local Chrome).
2. **Figma MCP server** for all writes: `https://mcp.figma.com/mcp` (OAuth on first
   connect; supports Dynamic Client Registration). Without MCP you can still capture and
   split images, and read file structure via `scripts/figma-info.js` + `FIGMA_TOKEN`.

## Playbooks (read the one matching your task)

- `skills/webshot/SKILL.md` — capture any webpage full-page (lazy-load, cookie banners,
  scroll-jacked sites, authenticated pages).
- `skills/figma-images/SKILL.md` — get image files into Figma/FigJam: split tall images
  (>~8000px breaks Figma rendering), `upload_assets` → POST → apply `imageHash` fill
  manually (it does NOT auto-apply on FigJam shapes).
- `skills/figma-diagrams/SKILL.md` — consistent FigJam diagrams: factory code + layout
  math for page-anatomy spines, sitemap trees, and detail-section grids.

## Hard-won facts (do not rediscover)

- Figma clients fail to render images taller than ~8000px → split first.
- `upload_assets` submitUrls are single-use and expire in 10 minutes.
- Uploaded images do not auto-fill FigJam shapes — set
  `fills = [{type:'IMAGE', scaleMode:'FILL', imageHash}]` via `use_figma`.
- `figma.createPage()` throws in FigJam; use `setCurrentPageAsync` to switch pages.
- Headless Chrome has no login session — authenticated pages need the user's running
  browser (never handle credentials/verification codes yourself).
- Users rearrange boards between your calls — read node positions before relative placement.

## Per-project config

Project specifics (file key, page IDs, style overrides, node inventory) live in a board
JSON outside this repo — template: `boards/example.json`. Look for it referenced from the
project's own agent context (CLAUDE.md, AGENTS.md, .cursorrules).
