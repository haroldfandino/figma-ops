#!/usr/bin/env node
// POST an image file to a Figma MCP upload submitUrl (obtained from the `upload_assets`
// MCP tool). Prints the JSON response containing the imageHash.
//
// Usage:
//   node figma-upload.js <file> <submitUrl>
//
// Notes:
// - submitUrls are SINGLE-USE and expire after 10 minutes; request one per image
//   via the upload_assets MCP tool (pass nodeId + scaleMode FILL).
// - The returned imageHash must then be applied as a fill via the use_figma MCP tool
//   (placement on FigJam shapes does NOT happen automatically):
//     n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }]

const fs = require('fs');
const path = require('path');

const [file, url] = process.argv.slice(2);
if (!file || !url) {
  console.error('Usage: node figma-upload.js <file> <submitUrl>');
  process.exit(1);
}

const type = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';

(async () => {
  const buf = fs.readFileSync(file);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), path.basename(file));
  const res = await fetch(url, { method: 'POST', body: fd });
  const text = await res.text();
  console.log(text);
  if (!res.ok) process.exit(1);
})();
