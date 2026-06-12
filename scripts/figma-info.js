#!/usr/bin/env node
// Read Figma/FigJam file structure via the REST API. Useful for agents without an MCP
// connection, or for quick lookups of page/node IDs from a terminal.
//
// Setup: create a personal access token (figma.com -> Settings -> Security ->
// Personal access tokens, scope "File content: read") and export it as FIGMA_TOKEN.
//
// Usage:
//   node figma-info.js <fileKey>                 # list pages with their IDs
//   node figma-info.js <fileKey> <nodeId>        # list a node's direct children
//
// The fileKey is in the URL: figma.com/design/<fileKey>/... or figma.com/board/<fileKey>/...
// Note: the REST API is read-only here - writes go through the Figma MCP server.

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error('Set FIGMA_TOKEN env var (Figma -> Settings -> Security -> Personal access tokens)');
  process.exit(1);
}

const [fileKey, nodeId] = process.argv.slice(2);
if (!fileKey) {
  console.error('Usage: node figma-info.js <fileKey> [nodeId]');
  process.exit(1);
}

const headers = { 'X-Figma-Token': token };

(async () => {
  if (!nodeId) {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, { headers });
    if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1); }
    const data = await res.json();
    console.log(`${data.name}  (lastModified ${data.lastModified}, editorType ${data.editorType || 'n/a'})`);
    for (const page of data.document.children) {
      console.log(`  page ${page.id}  ${page.name}`);
    }
  } else {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=1`, { headers });
    if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1); }
    const data = await res.json();
    const node = data.nodes[nodeId.replace('-', ':')] || Object.values(data.nodes)[0];
    if (!node) { console.error('Node not found'); process.exit(1); }
    const d = node.document;
    console.log(`${d.type} ${d.id}  ${d.name}`);
    for (const c of d.children || []) {
      const bb = c.absoluteBoundingBox || {};
      console.log(`  ${c.type} ${c.id}  "${c.name}"  x=${bb.x} y=${bb.y} w=${bb.width} h=${bb.height}`);
    }
  }
})();
