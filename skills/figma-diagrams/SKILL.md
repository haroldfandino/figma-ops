---
name: figma-diagrams
description: Build consistent FigJam diagrams (page-anatomy spines, sitemaps, detail-section grids) via the Figma MCP server. Use when diagramming a website/app structure, a proposal, or any boxes-sections-connectors layout in FigJam. Provides paste-ready factory code and exact layout math.
---

# figma-diagrams — FigJam diagram patterns

Requires the Figma MCP server. Load your client's Figma plugin-API guidance first if
available (e.g. Claude Code: `figma-use` + `figma-use-figjam` skills). Style tokens below
are sane defaults matching FigJam's native palette — override per project via a board
config (see `boards/example.json`).

## Factory snippet (paste into use_figma code)

```js
const h = (r,g,b) => ({ r: r/255, g: g/255, b: b/255 });
const FONT = { family: 'Inter', style: 'Medium' };
await figma.loadFontAsync(FONT);
const GRAY = h(0x75,0x75,0x75), DARK = h(0x1E,0x1E,0x1E);
const P = {
  white:  { fill: h(0xFF,0xFF,0xFF), stroke: GRAY },                 // default node
  yellow: { fill: h(0xFF,0xEC,0xBD), stroke: h(0xFF,0xC9,0x43) },    // root / highlight
  green:  { fill: h(0xCD,0xF4,0xD3), stroke: h(0x66,0xD5,0x75) },    // goal / new / shipped
  gray:   { fill: h(0xD9,0xD9,0xD9), stroke: h(0xB3,0xB3,0xB3) },    // external / note
  red:    { fill: h(0xFF,0xCD,0xC2), stroke: h(0xFF,0x75,0x56) },    // issues / warnings
};
function mkShape(label, x, y, preset, hgt) {
  const s = figma.createShapeWithText();
  s.shapeType = 'SQUARE'; s.text.characters = label; s.text.fontSize = 16;
  s.resize(224, hgt || 128);
  s.fills = [{ type: 'SOLID', color: preset.fill }];
  s.strokes = [{ type: 'SOLID', color: preset.stroke }];
  s.strokeWeight = 4;
  s.text.fills = [{ type: 'SOLID', color: DARK }];
  s.x = x; s.y = y; return s;
}
function mkSection(name, x, y, w, hgt, fill) {
  const sec = figma.createSection();
  sec.name = name; sec.x = x; sec.y = y; sec.resize(w, hgt);
  sec.fills = [{ type: 'SOLID', color: fill || h(0xEA,0xE1,0xFF) }];
  return sec;
}
function connect(fromId, toId, opts) { // opts: {side:true => RIGHT->LEFT, dashed:true}
  const c = figma.createConnector();
  c.connectorStart = { endpointNodeId: fromId, magnet: (opts && opts.side) ? 'RIGHT' : 'BOTTOM' };
  c.connectorEnd = { endpointNodeId: toId, magnet: (opts && opts.side) ? 'LEFT' : 'TOP' };
  c.connectorLineType = 'ELBOWED';
  c.connectorStartStrokeCap = 'NONE'; c.connectorEndStrokeCap = 'ARROW_LINES';
  c.strokes = [{ type: 'SOLID', color: GRAY }]; c.strokeWeight = 4;
  if (opts && opts.dashed) c.dashPattern = [10, 10];
  return c;
}
function mkText(chars, x, y, size, color) {
  const t = figma.createText();
  t.fontName = FONT; t.fontSize = size; t.characters = chars;
  t.fills = [{ type: 'SOLID', color }];
  t.x = x; t.y = y; return t;
}
```

Titles: `mkText(title, x, y, 64, h(0x33,0x33,0x33))` with a 14px gray subtitle ~94px below.
List nodes: same SQUARE, taller (200–324), newline-separated lines.

## Layout patterns

**Page-anatomy spine** (current-state or proposed page structure):
- Yellow root node, vertical spine of white nodes at fixed x, chained BOTTOM→TOP.
- Each spine node connects RIGHT→LEFT to a detail section ~500px right.
- Section grid: children at `x = 48 + i*288` (224 node + 64 gap), `y = 48`; one row → 224
  high; two rows → second row `y = 240`, section 416 high.
  Width = `96 + n*224 + (n-1)*64`.
- Spine pitch 320 per 224-high section; center each spine node on its section:
  `spineY = sectionY + sectionH/2 - 64`.

**Sitemap tree** (proposals): yellow root top-center; children in a row 344 below
(step 288), BOTTOM→TOP connectors. Dashed = external/role-gated; green = conversion goal
or key innovation; sub-nodes a further 320 below their parent. Gray "Principles" list node
at top right of the tree.

**Diagram column convention**: each diagram (current state, proposal, moodboard) is its own
column on the page, title at top, ~700px gap between columns — so pages read left to right
as a story (before → analysis → after → references).

## Working rules

- ~10 logical operations per `use_figma` call; shapes/sections in one call, connectors next,
  referencing returned IDs as string literals.
- Always `return` created/mutated node IDs.
- Users rearrange boards between calls — read current x/y (or `get_figjam`) before
  positioning relative to existing nodes.
- Verify each diagram with `await section.screenshot()` at the end.
- FigJam has no `figma.createPage()` — switch pages with `setCurrentPageAsync` only.
- Mermaid alternative: for quick standalone diagrams the `generate_diagram` MCP tool is
  faster but cannot match an existing board's style; use these patterns when consistency
  matters.
