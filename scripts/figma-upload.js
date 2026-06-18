#!/usr/bin/env node
// POST an image file to a Figma MCP upload submitUrl (obtained from the `upload_assets`
// MCP tool). Prints the JSON response containing the imageHash.
//
// Auto-compression: Figma rejects assets over 10MB. If the file is larger, this script
// transparently produces a JPEG (progressively lowering quality, then downscaling width)
// until it fits, and uploads that instead. The original file is left untouched; the
// compressed copy is written next to it as <name>.upload.jpg.
//
// Usage:
//   node figma-upload.js <file> <submitUrl> [--max-mb=10] [--keep]
//     --max-mb  override the size ceiling (default 10)
//     --keep    keep the generated .upload.jpg (default: deleted after upload)
//
// Notes:
// - submitUrls are SINGLE-USE and expire after 10 minutes; request one per image
//   via the upload_assets MCP tool (pass nodeId + scaleMode FILL).
// - Apply the returned imageHash as a fill via use_figma (FigJam shapes do NOT auto-fill):
//     n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }]

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// POST a file as multipart/form-data using Node's built-in http(s). Avoids undici's
// FormData, which leaves a handle open and triggers a libuv teardown assertion on Windows.
function postMultipart(urlStr, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const boundary = '----figmaops' + Date.now().toString(16);
    const fileBuf = fs.readFileSync(filePath);
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, fileBuf, tail]);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const [file, url] = positional;
if (!file || !url) {
  console.error('Usage: node figma-upload.js <file> <submitUrl> [--max-mb=10] [--keep]');
  process.exit(1);
}

const MAX_BYTES = Math.floor(parseFloat(flags['max-mb'] || '10') * 1024 * 1024);
// Compress a little under the hard cap so we never land exactly on the edge.
const TARGET_BYTES = Math.floor(MAX_BYTES * 0.95);

// Produce a JPEG copy that fits under TARGET_BYTES. Returns the new path, or throws.
async function compressToFit(srcPath) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    throw new Error(
      'File exceeds ' + (MAX_BYTES / 1048576).toFixed(0) +
      'MB and sharp is not installed to compress it. Run `npm install` in figma-ops.'
    );
  }
  const out = srcPath.replace(/\.(png|jpe?g|webp|gif)$/i, '') + '.upload.jpg';
  const meta = await sharp(srcPath).metadata();
  const widths = [meta.width, 1512, 1200, 1000].filter((w, i, a) => w && a.indexOf(w) === i && w <= meta.width);
  const qualities = [85, 80, 72, 65, 55];

  let best = null;
  for (const w of widths) {
    for (const q of qualities) {
      let pipe = sharp(srcPath);
      if (w < meta.width) pipe = pipe.resize({ width: w });
      await pipe.jpeg({ quality: q, mozjpeg: true }).toFile(out);
      const size = fs.statSync(out).size;
      best = { w, q, size };
      if (size <= TARGET_BYTES) {
        return { out, w, q, size };
      }
    }
  }
  // Nothing fit; return the smallest we managed (last written) and let caller decide.
  return { out, w: best.w, q: best.q, size: best.size, overLimitStill: best.size > MAX_BYTES };
}

(async () => {
  let uploadPath = file;
  let cleanup = false;

  const size = fs.statSync(file).size;
  if (size > MAX_BYTES) {
    process.stderr.write(
      `[auto-jpeg] ${path.basename(file)} is ${(size / 1048576).toFixed(2)}MB (> ${(MAX_BYTES / 1048576).toFixed(0)}MB); compressing...\n`
    );
    const r = await compressToFit(file);
    uploadPath = r.out;
    cleanup = !flags.keep;
    process.stderr.write(
      `[auto-jpeg] -> ${path.basename(r.out)} ${r.w}px q${r.q} = ${(r.size / 1048576).toFixed(2)}MB\n`
    );
    if (r.overLimitStill) {
      process.stderr.write('[auto-jpeg] WARNING: still over the limit after max compression; upload may fail.\n');
    }
  }

  const type = /\.jpe?g$/i.test(uploadPath) ? 'image/jpeg' : 'image/png';
  let res;
  try {
    res = await postMultipart(url, uploadPath, type);
  } finally {
    if (cleanup) {
      try { fs.unlinkSync(uploadPath); } catch (e) { /* ignore */ }
    }
  }
  console.log(res.text);
  process.exit(res.ok ? 0 : 1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
